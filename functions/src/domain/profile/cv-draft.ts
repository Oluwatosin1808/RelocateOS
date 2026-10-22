import { z } from "zod";
import type { CandidateProfile } from "../schemas/candidate-profile";

/**
 * CV → profile draft extraction (deterministic) and the review-then-apply merge.
 *
 * Extraction reads ONLY what is literally in the uploaded text; every applied
 * fact is stamped `imported-pending-review` (schema provenance) so it is never
 * confused with user-asserted facts. The merge never overwrites existing
 * user-asserted values — it fills empty contact fields, appends de-duplicated
 * entries, and reports conflicts/skips honestly.
 */

// ---------------------------------------------------------------------------
// Draft schema (extraction-stage — dates may still be raw strings)
// ---------------------------------------------------------------------------

export const cvDraftContactSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  currentCity: z.string().default(""),
  currentCountry: z.string().default(""),
  nationality: z.string().default(""),
  linkedinUrl: z.string().default(""),
  githubUrl: z.string().default(""),
  portfolioUrls: z.array(z.string()).default([]),
});

export const cvDraftExperienceSchema = z.object({
  jobTitle: z.string().default(""),
  employer: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  isCurrent: z.boolean().default(false),
  description: z.string().default(""),
  technologies: z.array(z.string()).default([]),
});

export const cvDraftEducationSchema = z.object({
  institution: z.string().default(""),
  qualification: z.string().default(""),
  fieldOfStudy: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  grade: z.string().default(""),
});

export const cvDraftSkillSchema = z.object({ name: z.string().min(1) });
export const cvDraftLanguageSchema = z.object({
  language: z.string().min(1),
  proficiency: z.string().default(""),
});
export const cvDraftProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  technologies: z.array(z.string()).default([]),
  url: z.string().default(""),
});
export const cvDraftCertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().default(""),
  issuedDate: z.string().default(""),
});

export const cvProfileDraftSchema = z.object({
  contact: cvDraftContactSchema.prefault({}),
  professionalSummary: z.string().default(""),
  workExperience: z.array(cvDraftExperienceSchema).default([]),
  education: z.array(cvDraftEducationSchema).default([]),
  skills: z.array(cvDraftSkillSchema).default([]),
  languages: z.array(cvDraftLanguageSchema).default([]),
  projects: z.array(cvDraftProjectSchema).default([]),
  certifications: z.array(cvDraftCertificationSchema).default([]),
});
export type CvProfileDraft = z.infer<typeof cvProfileDraftSchema>;

export const CV_MERGE_SECTIONS = [
  "contact",
  "summary",
  "workExperience",
  "education",
  "skills",
  "languages",
  "projects",
  "certifications",
] as const;
export type CvMergeSection = (typeof CV_MERGE_SECTIONS)[number];
export type CvMergeSelections = Record<CvMergeSection, boolean>;

// ---------------------------------------------------------------------------
// Date normalisation
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10",
  october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

/** Normalise one CV date token to "YYYY-MM" | "YYYY" | null when unparsable. */
export function normaliseCvDate(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? `${m[1]}-${String(mo).padStart(2, "0")}` : null;
  }
  if (/^\d{4}$/.test(s)) return s;
  m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const mo = Number(m[1]);
    return mo >= 1 && mo <= 12 ? `${m[2]}-${String(mo).padStart(2, "0")}` : null;
  }
  m = s.match(/^([a-z]+)\s+(\d{4})$/);
  if (m && MONTHS[m[1]!]) return `${m[2]}-${MONTHS[m[1]!]}`;
  m = s.match(/^(\d{4})\s+([a-z]+)$/);
  if (m && MONTHS[m[2]!]) return `${m[1]}-${MONTHS[m[2]!]}`;
  return null;
}

const DATE_TOKEN =
  /((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}|\d{4})/gi;
const PRESENT_RE = /\b(present|current|now|ongoing|to date)\b/i;

type DateRange = { start: string; end: string; isCurrent: boolean };

/** Detect a date-range within a line; requires two years or a "Present". */
function detectDateRange(line: string): DateRange | null {
  const tokens = [...line.matchAll(DATE_TOKEN)].map((m) => m[1]!);
  const hasPresent = PRESENT_RE.test(line);
  if (tokens.length === 0) return null;
  if (tokens.length === 1 && !hasPresent) return null;
  const start = normaliseCvDate(tokens[0]!);
  if (!start) return null;
  if (hasPresent) return { start, end: "", isCurrent: true };
  const end = tokens[1] ? normaliseCvDate(tokens[1]) : null;
  return { start, end: end ?? "", isCurrent: false };
}

// ---------------------------------------------------------------------------
// Deterministic parser
// ---------------------------------------------------------------------------

type SectionKey =
  | "summary" | "experience" | "education" | "skills"
  | "languages" | "certifications" | "projects";

const SECTION_PATTERNS: { key: SectionKey; re: RegExp }[] = [
  { key: "summary", re: /^(summary|professional summary|profile|about (me|the candidate)|objective|career objective)\b/i },
  { key: "experience", re: /^((work|professional|relevant)\s+)?((work\s+)?experience|employment(\s+(history|record|background))?|work\s+history|career\s+history)\b/i },
  { key: "education", re: /^(education|academic (background|qualifications?)|qualifications?)\b/i },
  { key: "skills", re: /^((technical|core|key)\s+)?(skills|competenc(y|ies)|technolog(y|ies)|tech stack|tools)\b/i },
  { key: "languages", re: /^languages?\b/i },
  { key: "certifications", re: /^(certifications?|certificates?|licenses?)\b/i },
  { key: "projects", re: /^(projects?\b|(selected|relevant|personal|key)\s+projects?\b|portfolio\b|links?\b)/i },
];

function isSectionHeader(line: string): SectionKey | null {
  const t = line.trim();
  if (!t || t.length > 45) return null;
  const letters = t.replace(/[^A-Za-z]/g, "");
  const isUpper = letters.length >= 3 && t === t.toUpperCase();
  const isColonEnd = /^[A-Za-z ]{1,40}:$/.test(t);
  // Short title-case LABEL only: letters/spaces (so "Technologies: React, TS"
  // inside a role body can never hijack the section split).
  const isShortLabel = t.split(/\s+/).length <= 3 && /^[A-Za-z&()/ -]+$/.test(t);
  if (!isUpper && !isColonEnd && !isShortLabel) return null;
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(t)) return key;
  }
  return null;
}

const BULLET_RE = /^\s*[•\-\*·▪◦‣–]\s+/;

const TECH_WORDS = [
  "react", "next.js", "nextjs", "typescript", "javascript", "html", "css", "tailwind",
  "node", "node.js", "python", "java", "sql", "graphql", "rest", "docker", "kubernetes",
  "aws", "gcp", "azure", "firebase", "figma", "vue", "angular", "svelte", "php", "laravel",
  "ruby", "rails", "go", "rust", "git", "jest", "cypress", "playwright", "bubble",
  "webflow", "supabase", "mongodb", "postgresql", "redis", "redux", "vue", "swift",
];

function splitList(line: string): string[] {
  return line
    .replace(BULLET_RE, "")
    .split(/[,;•|·]|\s+\/\s+|\s{2,}(?:and|&)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60);
}

export function normaliseUrl(raw: string): string {
  // first whitespace-delimited token only (AI sometimes echoes "… · …")
  const s = raw.trim().split(/\s+/)[0]!.replace(/[.,;·]+$/, "");
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Deterministic extraction from raw CV text. Best-effort by design. */
export function parseCvDraft(text: string): CvProfileDraft {
  const lines = text.split(/\r?\n/);
  const draft = cvProfileDraftSchema.parse({});

  // --- contact: whole-text regexes (reliable) ---
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (email) draft.contact.email = email[0];
  // Phone: require ≥9 digits or a leading + so year-ranges never match.
  for (const cand of text.matchAll(/(?:\+?\d[\d\s().-]{7,}\d)/g)) {
    const digits = cand[0]!.replace(/\D/g, "");
    if (cand[0]!.startsWith("+") || digits.length >= 9) {
      if (!/^(19|20)\d{2}[\s/.-]*(19|20)\d{2}$/.test(cand[0]!.trim())) {
        draft.contact.phone = cand[0].trim();
        break;
      }
    }
  }
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,;)"']+/i);
  if (linkedin) draft.contact.linkedinUrl = normaliseUrl(linkedin[0]);
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,;)"']+/i);
  if (github) draft.contact.githubUrl = normaliseUrl(github[0]);

  // Portfolio / personal site: labelled anywhere ("Portfolio: ada.dev") or bare
  // URL-ish tokens in the contact header lines — never linkedin/github, free
  // mail hosts, or the email's own domain (so an email host never becomes a
  // "portfolio"). Honest extraction only; cap at 5.
  const emailDomain = draft.contact.email.split("@")[1]?.toLowerCase().replace(/^www\./, "") ?? "";
  const NON_PORTFOLIO_HOSTS = new Set([
    "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.co.uk", "aol.com",
    "icloud.com", "me.com", "proton.me", "protonmail.com", "live.com", "msn.com",
    "yandex.com", "mail.com", "gmx.com", "zoho.com", "example.com", "example.org",
  ]);
  const portfolioSeen = new Set<string>();
  const addPortfolio = (raw: string) => {
    const u = normaliseUrl(raw);
    if (!/^https?:\/\/\S+$/i.test(u) || portfolioSeen.size >= 5) return;
    const host = u.replace(/^https?:\/\//i, "").split(/[/?#]/)[0]!.toLowerCase().replace(/^www\./, "");
    if (!host || !host.includes(".")) return;
    if (host.includes("linkedin.com") || host.includes("github.com")) return;
    if (NON_PORTFOLIO_HOSTS.has(host) || host.endsWith(".example.com")) return;
    if (emailDomain && (host === emailDomain || host.endsWith(`.${emailDomain}`))) return;
    portfolioSeen.add(u);
  };
  // Header contact lines: explicit http(s)/www tokens + bare domains on a
  // conservative TLD allowlist (so "Next.js" or "2024.5" never match).
  for (const line of lines.slice(0, 6)) {
    for (const m of line.matchAll(
      /(?:https?:\/\/|www\.)[^\s,;•|)'"]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+(?:dev|io|me|nl|be|app|site|design|tech|ai|xyz|co|uk|to|sh|fm|com|net|org)\b(?:\/[^\s,;•|)'"]*)?/gi,
    )) {
      if (!m[0].includes("@")) addPortfolio(m[0]);
    }
  }
  // Labelled values anywhere in the CV text
  for (const m of text.matchAll(
    /(?:portfolio|website|web\s?site|personal\s?site|homepage)\s*[:\-–—]\s*((?:https?:\/\/)?[^\s,;•|)'"]+)/gi,
  )) {
    addPortfolio(m[1]!);
  }
  draft.contact.portfolioUrls = [...portfolioSeen];

  // City/Country: contact line such as "Lagos, Nigeria · email…"
  for (const raw of lines.slice(0, 4)) {
    if (!/[@·|]/.test(raw)) continue;
    const t = raw.split(/[@·|]/)[0]!.trim();
    if (!t) continue;
    const m = t.match(/^([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Za-z][A-Za-z .'-]{1,40})$/);
    if (m && m[1] && m[2]) {
      draft.contact.currentCity = m[1].trim();
      draft.contact.currentCountry = m[2].trim();
      break;
    }
  }

  // Name: first line that looks like a person's name (2–4 words, letters only)
  for (const raw of lines.slice(0, 8)) {
    const t = raw.trim();
    if (!t || t.length > 60 || /[@\d]/.test(t)) continue;
    if (isSectionHeader(t)) continue;
    const words = t.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z'.-]{2,}$/.test(w))) {
      const lower = words.map((w) => w.toLowerCase());
      if (!lower.some((w) => ["curriculum", "vitae", "resume", "cv"].includes(w))) {
        draft.contact.fullName = t;
      }
    }
    break;
  }

  // --- section split ---
  const sections: Record<SectionKey, string[]> = {
    summary: [], experience: [], education: [], skills: [],
    languages: [], certifications: [], projects: [],
  };
  let current: SectionKey | null = null;
  for (const line of lines) {
    const header = isSectionHeader(line);
    if (header) {
      current = header;
      continue;
    }
    if (current) sections[current].push(line);
  }

  draft.professionalSummary = sections.summary
    .filter((l) => l.trim() && !BULLET_RE.test(l))
    .join(" ")
    .trim()
    .slice(0, 2000);

  // --- skills (case-insensitive dedupe: CV list beats TECH_WORDS casing) ---
  const skillMap = new Map<string, string>();
  const addSkill = (raw: string) => {
    const name = raw.trim().replace(/\s{2,}/g, " ");
    if (name.length < 2 || name.length > 60 || /^\d+$/.test(name)) return;
    const key = name.toLowerCase();
    if (!skillMap.has(key)) skillMap.set(key, name);
  };
  for (const line of sections.skills) {
    if (!line.trim()) continue;
    for (const s of splitList(line)) addSkill(s);
  }
  // Whole-text technology scan as a safety net
  const lowerText = text.toLowerCase();
  for (const t of TECH_WORDS) {
    if (new RegExp(`\\b${t.replace(".", "\\.")}\\b`).test(lowerText)) addSkill(t);
  }
  draft.skills = [...skillMap.values()].slice(0, 60).map((name) => ({ name }));

  // --- languages: "English (Fluent)" / "French — Native" ---
  for (const line of sections.languages) {
    const m = line.replace(BULLET_RE, "").trim().match(/^([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*[\(–—:-]\s*([A-Za-z ]+))?[\)]?$/);
    if (m && m[1]) {
      const language = m[1].trim();
      if (language.length >= 3) {
        draft.languages.push({ language, proficiency: (m[2] ?? "").trim().toLowerCase() });
      }
    }
  }

  // --- experience: pending/title lines vs date lines ---
  type ExpSeg = { pre: string[]; dateLine: string; body: string[]; range: DateRange };
  const expSegs: ExpSeg[] = [];
  let pending: string[] = [];
  let curSeg: ExpSeg | null = null;
  const isBodyLine = (l: string) =>
    BULLET_RE.test(l) || !l.trim() || /^(tech\w*|stack|tools)\s*:/i.test(l.trim());
  for (const line of sections.experience) {
    const range = detectDateRange(line);
    if (range) {
      if (curSeg) expSegs.push(curSeg);
      curSeg = { pre: pending, dateLine: line, body: [], range };
      pending = [];
    } else if (curSeg && isBodyLine(line)) {
      curSeg.body.push(line);
    } else {
      // plain text: either the NEXT entry's title (before its date line) or
      // pre-section title lines — accumulated until a date line consumes them
      pending.push(line);
    }
  }
  if (curSeg) {
    curSeg.body.push(...pending); // trailing plain text stays with last entry
    expSegs.push(curSeg);
  }

  for (const seg of expSegs) {
    // Employer/location live on the date line prefix: "Acme BV, Amsterdam  Jan 2022 – Present"
    const prefix = seg.dateLine
      .replace(DATE_TOKEN, "")
      .replace(PRESENT_RE, "")
      .replace(/^[\s,;:·|–—-]+|[\s,;:·|–—-]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const preClean = seg.pre.map((l) => l.trim()).filter(Boolean);
    let employer = "";
    let location = "";
    if (prefix) {
      const idx = prefix.indexOf(",");
      if (idx > 0) {
        employer = prefix.slice(0, idx);
        location = prefix.slice(idx + 1).trim();
      } else {
        employer = prefix;
      }
    }
    let jobTitle = preClean.length > 0 ? preClean[preClean.length - 1]! : "";
    if (!employer) {
      if (preClean.length >= 2) {
        employer = preClean[preClean.length - 2]!;
        jobTitle = preClean[preClean.length - 1]!;
      } else {
        continue; // cannot split title/employer honestly — omit rather than guess
      }
    }
    if (!jobTitle || jobTitle === employer) continue;
    const bullets = seg.body.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, "").trim());
    const techLine = seg.body.find((l) => /^(tech\w*|stack|tools)\s*:/i.test(l.trim()));
    draft.workExperience.push({
      jobTitle: cleanExperienceLine(jobTitle, employer),
      employer: cleanEmployerLine(employer),
      location: location.slice(0, 160),
      startDate: seg.range.start,
      endDate: seg.range.end,
      isCurrent: seg.range.isCurrent,
      description: bullets.join("\n").slice(0, 4000),
      technologies: techLine ? splitList(techLine.replace(/^[^:]+:\s*/i, "")) : [],
    });
  }

  // --- education: lines with a year, split on common separators ---
  for (const raw of sections.education) {
    const line = raw.replace(BULLET_RE, "").trim();
    if (!line) continue;
    const range = detectDateRange(line);
    const years = [...line.matchAll(/\b(19|20)\d{2}\b/g)];
    if (years.length === 0) continue;
    const withoutYears = line
      .replace(DATE_TOKEN, "")
      .replace(PRESENT_RE, "")
      .replace(/^[\s,;:()]*[–—|-][\s,;:()]*|[\s,;:()]*[–—|-][\s,;:()]*$/, "")
      .replace(/[(),\s]+$/, "")
      .trim();
    const parts = withoutYears.split(/\s*[–—|-]\s+|\s+\bat\b\s+|\s*,\s+|\s{2,}/).filter(Boolean);
    if (parts.length >= 2) {
      draft.education.push({
        institution: parts[parts.length - 1]!,
        qualification: parts.slice(0, -1).join(" – "),
        fieldOfStudy: "",
        startDate: range?.start ?? "",
        endDate: range?.end ?? (range?.isCurrent ? "" : ""),
        grade: "",
      });
    }
  }

  // --- projects: plain line starts an entry; bullets/URL/tech attach ---
  type ProjSeg = { name: string; desc: string[]; url: string; technologies: string[] };
  let curProj: ProjSeg | null = null;
  const pushProj = () => {
    if (curProj && curProj.name.trim()) {
      draft.projects.push({
        name: curProj.name.trim().slice(0, 160),
        description: curProj.desc.join("\n").slice(0, 3000),
        url: curProj.url,
        technologies: [...new Set(curProj.technologies)].slice(0, 40),
      });
    }
    curProj = null;
  };
  for (const raw of sections.projects) {
    const line = raw.trim();
    if (!line) continue;
    if (BULLET_RE.test(raw)) {
      if (curProj) curProj.desc.push(raw.replace(BULLET_RE, "").trim());
      continue;
    }
    const techM = line.match(/^(?:tech\w*|stack|tools)\s*:\s*(.+)$/i);
    if (techM) {
      if (curProj) curProj.technologies.push(...splitList(techM[1]!));
      continue;
    }
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(line)) {
      const u = normaliseUrl(line);
      // A bare URL with no current entry is a portfolio link, not a project.
      if (curProj) curProj.url = u;
      else if (!/linkedin\.com|github\.com/i.test(u)) draft.contact.portfolioUrls.push(u);
      continue;
    }
    // New entry: strip date parens + parenthetical URLs, split "Name — description"
    pushProj();
    let nameLine = line;
    let url = "";
    const urlParens = nameLine.match(/\(\s*((?:https?:\/\/|www\.)[^\s)]+)\s*\)/i);
    if (urlParens) {
      url = normaliseUrl(urlParens[1]!);
      nameLine = nameLine.replace(urlParens[0], " ");
    }
    const trailingUrl = nameLine.match(/\s+((?:https?:\/\/|www\.)\S+)\s*$/);
    if (trailingUrl && !url) {
      url = normaliseUrl(trailingUrl[1]!);
      nameLine = nameLine.replace(trailingUrl[0], " ");
    }
    nameLine = nameLine
      .replace(/\([^)]*\)/g, (s) =>
        detectDateRange(s) || /^\(\s*(?:19|20)\d{2}\s*\)$/.test(s) ? " " : s,
      )
      .replace(/\s{2,}/g, " ")
      .trim();
    const parts = nameLine.split(/\s+[—–]\s+|\s+-\s+/);
    const name = (parts[0] ?? "").replace(/\s{2,}/g, " ").trim();
    const desc0 = parts.slice(1).join(" — ").trim();
    curProj = { name, desc: desc0 ? [desc0] : [], url, technologies: [] };
  }
  pushProj();

  // --- certifications: "Name — Issuer, 2023" / "Name (Issuer, 2022)" ---
  for (const raw of sections.certifications) {
    const line = raw.replace(BULLET_RE, "").trim();
    if (!line || line.length < 4 || /^(https?:\/\/|www\.)/i.test(line)) continue;
    const tokens = [...line.matchAll(DATE_TOKEN)].map((m) => m[1]!);
    const issuedDate = tokens.length > 0 ? normaliseCvDate(tokens[tokens.length - 1]!) ?? "" : "";
    const rest = line
      .replace(DATE_TOKEN, " ")
      .replace(PRESENT_RE, " ")
      .replace(/[\s,;:()[\]]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    let name = rest;
    let issuer = "";
    const parts = rest.split(/\s*[—–]\s+|\s+\|\s+|\s*:\s+|\s+-\s+/);
    if (parts.length >= 2 && parts[0]!.trim()) {
      name = parts[0]!.trim();
      issuer = parts.slice(1).join(" ").replace(/^[\s,;:]+|[\s,;:]+$/g, "").trim();
    } else {
      const paren = rest.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      const inner = paren?.[2] ?? "";
      // Inner parens are an issuer only when they carry a comma or two+ words;
      // "(CSM)" stays part of the name, "(Coursera, 2022)" becomes the issuer.
      if (paren && paren[1]!.trim() && inner && (inner.includes(" ") || inner.includes(","))) {
        name = paren[1]!.trim();
        issuer = inner.replace(/[\d]{4}/g, "").replace(/[\s,;:]+$/, "").trim();
      }
    }
    name = name.replace(/\s{2,}/g, " ").trim().slice(0, 200);
    if (name.length < 4) continue;
    draft.certifications.push({ name, issuer: issuer.slice(0, 200), issuedDate });
    if (draft.certifications.length >= 20) break;
  }

  // Portfolio list: normalise, dedupe case-insensitively, cap at 5.
  draft.contact.portfolioUrls = [
    ...new Set(draft.contact.portfolioUrls.map((u) => normaliseUrl(u))),
  ].slice(0, 5);

  return draft;
}

function cleanExperienceLine(title: string, employer: string): string {
  // "Senior Engineer, Acme BV" when title line accidentally contains employer
  let t = title;
  if (t.toLowerCase().startsWith(employer.toLowerCase().split(",")[0]!)) {
    t = t.slice(employer.split(",")[0]!.length).replace(/^[\s,·|–—-]+/, "");
  }
  return t.replace(/\s{2,}/g, " ").trim().slice(0, 160);
}

function cleanEmployerLine(employer: string): string {
  // Strip trailing location/date residue: "Acme BV, Amsterdam" → keep "Acme BV, Amsterdam"
  return employer.replace(/\s{2,}/g, " ").replace(/^[\s,·|–—-]+|[\s,·|–—-]+$/g, "").slice(0, 160);
}

// ---------------------------------------------------------------------------
// Merge (review → profile), never overwrites user-asserted facts
// ---------------------------------------------------------------------------

export type CvMergeResult = {
  profile: CandidateProfile;
  applied: Partial<Record<CvMergeSection, number>>;
  conflicts: string[];
  skipped: string[];
};

const SKILL_CATEGORY = (name: string): "language" | "framework" | "tool" | "platform" | "design" | "ai" | "soft" | "other" => {
  const n = name.toLowerCase();
  if (/^(english|french|german|dutch|spanish|portuguese|arabic|yoruba|igbo|hausa)\b/.test(n)) return "language";
  if (["react", "next.js", "nextjs", "angular", "vue", "svelte", "tailwind", "bootstrap"].some((t) => n.includes(t))) return "framework";
  if (["figma", "sketch", "photoshop", "illustrator", "git", "docker", "jira", "postman"].some((t) => n.includes(t))) return "tool";
  if (["aws", "gcp", "azure", "firebase", "supabase", "vercel", "netlify", "sql", "postgresql", "mongodb", "redis"].some((t) => n.includes(t))) return "platform";
  if (/^(ux|ui|design system|accessibility|prototyp)/.test(n)) return "design";
  if (/^(llm|ai|machine learning|openai|gemini|prompt)/.test(n)) return "ai";
  if (/^(communication|leadership|teamwork|mentoring)/.test(n)) return "soft";
  return "other";
};

const LANGUAGE_LEVEL = (raw: string): "basic" | "conversational" | "professional" | "fluent" | "native" | null => {
  const n = raw.toLowerCase();
  if (!n.trim()) return null;
  if (/native|motherspeech/.test(n)) return "native";
  if (/fluent|bilingual/.test(n)) return "fluent";
  if (/professional|business|working/.test(n)) return "professional";
  if (/conversational|intermediate/.test(n)) return "conversational";
  if (/basic|elementary|a1|a2|beginner/.test(n)) return "basic";
  return null;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Apply a reviewed draft to the profile per section selections.
 * Contact: fills ONLY empty fields (existing user values win, logged as conflict).
 * Arrays: append de-duplicated entries stamped `imported-pending-review`.
 * Unparsable facts are skipped with an honest reason — never guessed.
 */
export function mergeDraftIntoProfile(
  profile: CandidateProfile,
  draft: CvProfileDraft,
  selections: CvMergeSelections,
  nowIso: string = new Date().toISOString(),
): CvMergeResult {
  const next: CandidateProfile = structuredClone(profile);
  const conflicts: string[] = [];
  const skipped: string[] = [];
  const applied: Partial<Record<CvMergeSection, number>> = {};

  if (selections.contact) {
    let n = 0;
    type ScalarContactKey = Exclude<keyof CvProfileDraft["contact"], "portfolioUrls">;
    const map: [ScalarContactKey, keyof CandidateProfile["contact"]][] = [
      ["fullName", "fullName"], ["email", "email"], ["phone", "phone"],
      ["currentCity", "currentCity"], ["currentCountry", "currentCountry"],
      ["nationality", "nationality"], ["linkedinUrl", "linkedinUrl"], ["githubUrl", "githubUrl"],
    ];
    for (const [dKey, pKey] of map) {
      const incoming = draft.contact[dKey]?.trim();
      if (!incoming) continue;
      if (pKey === "linkedinUrl" || pKey === "githubUrl") {
        if (!/^https?:\/\/\S+$/.test(incoming)) {
          skipped.push(`contact.${pKey}: not a valid URL — skipped.`);
          continue;
        }
      }
      const existing = (next.contact as unknown as Record<string, string | undefined>)[pKey]?.trim();
      if (!existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next.contact as any)[pKey] = incoming;
        n += 1;
      } else if (existing.toLowerCase() !== incoming.toLowerCase()) {
        conflicts.push(`contact.${pKey}: profile keeps "${existing}" (CV said "${incoming}").`);
      }
    }
    // Portfolio URLs: additive only — append new valid URLs, never remove
    // existing ones; case-insensitive dedupe; cap at the schema max of 20.
    for (const raw of draft.contact.portfolioUrls) {
      const u = normaliseUrl(raw);
      const host = u.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? "";
      if (!/^https?:\/\/\S+$/i.test(u) || !host.includes(".")) {
        skipped.push(`contact.portfolioUrls: "${raw}" not a valid URL — skipped.`);
        continue;
      }
      if (next.contact.portfolioUrls.some((x) => x.toLowerCase() === u.toLowerCase())) continue;
      if (next.contact.portfolioUrls.length >= 20) {
        skipped.push("contact.portfolioUrls: 20-URL limit reached — remaining skipped.");
        break;
      }
      next.contact.portfolioUrls.push(u);
      n += 1;
    }
    if (n > 0) applied.contact = n;
  }

  if (selections.summary) {
    if (!next.professionalSummary.trim() && draft.professionalSummary.trim()) {
      next.professionalSummary = draft.professionalSummary.trim().slice(0, 2000);
      applied.summary = 1;
    } else if (next.professionalSummary.trim()) {
      conflicts.push("summary: profile already has a user-confirmed summary — kept.");
    }
  }

  if (selections.workExperience) {
    let n = 0;
    for (const exp of draft.workExperience) {
      if (!exp.jobTitle.trim() || !exp.employer.trim()) {
        skipped.push(`experience "${exp.jobTitle || exp.employer || "?"}": missing title or employer — skipped.`);
        continue;
      }
      const startDate = normaliseCvDate(exp.startDate);
      if (!startDate) {
        skipped.push(`experience "${exp.jobTitle} at ${exp.employer}": start date "${exp.startDate || "?"}" not parsable — skipped (edit manually).`);
        continue;
      }
      const endDate = exp.isCurrent ? "" : (normaliseCvDate(exp.endDate) ?? "");
      const dupe = next.workExperience.some(
        (w) =>
          w.jobTitle.toLowerCase() === exp.jobTitle.trim().toLowerCase() &&
          w.employer.toLowerCase() === exp.employer.trim().toLowerCase() &&
          w.startDate === startDate,
      );
      if (dupe) continue;
      next.workExperience.push({
        id: newId("exp"),
        jobTitle: exp.jobTitle.trim().slice(0, 160),
        employer: exp.employer.trim().slice(0, 160),
        location: exp.location.trim().slice(0, 160),
        employmentType: "unknown",
        startDate,
        endDate,
        isCurrent: exp.isCurrent,
        description: exp.description.slice(0, 4000),
        technologies: exp.technologies.map((t) => t.slice(0, 80)).slice(0, 40),
        provenance: "imported-pending-review",
      });
      n += 1;
    }
    if (n > 0) applied.workExperience = n;
  }

  if (selections.education) {
    let n = 0;
    for (const ed of draft.education) {
      if (!ed.institution.trim() || !ed.qualification.trim()) {
        skipped.push(`education "${ed.institution || ed.qualification}": missing institution or qualification — skipped.`);
        continue;
      }
      const startDate = ed.startDate ? normaliseCvDate(ed.startDate) ?? "" : "";
      const endDate = ed.endDate ? normaliseCvDate(ed.endDate) ?? "" : "";
      const dupe = next.education.some(
        (e) =>
          e.institution.toLowerCase() === ed.institution.trim().toLowerCase() &&
          e.qualification.toLowerCase() === ed.qualification.trim().toLowerCase(),
      );
      if (dupe) continue;
      next.education.push({
        id: newId("edu"),
        institution: ed.institution.trim().slice(0, 200),
        qualification: ed.qualification.trim().slice(0, 200),
        fieldOfStudy: ed.fieldOfStudy.trim().slice(0, 200),
        startDate,
        endDate,
        grade: ed.grade.trim().slice(0, 80) || undefined,
        description: "",
        provenance: "imported-pending-review",
      });
      n += 1;
    }
    if (n > 0) applied.education = n;
  }

  if (selections.skills) {
    let n = 0;
    const existingNames = new Set(next.skills.map((s) => s.name.toLowerCase()));
    for (const skill of draft.skills) {
      const name = skill.name.trim().replace(/\s{2,}/g, " ").slice(0, 80);
      if (!name || name.length < 2) continue;
      if (existingNames.has(name.toLowerCase())) continue;
      existingNames.add(name.toLowerCase());
      next.skills.push({
        id: newId("skill"),
        name,
        category: SKILL_CATEGORY(name),
        yearsExperience: null,
        provenance: "imported-pending-review",
      });
      n += 1;
    }
    if (n > 0) applied.skills = n;
  }

  if (selections.languages) {
    let n = 0;
    const existingLangs = new Set(next.languages.map((l) => l.language.toLowerCase()));
    for (const lang of draft.languages) {
      const language = lang.language.trim().slice(0, 80);
      if (!language || existingLangs.has(language.toLowerCase())) continue;
      const level = LANGUAGE_LEVEL(lang.proficiency);
      if (!level) {
        skipped.push(`language "${language}": no recognisable level in CV — skipped (add it in the editor).`);
        continue;
      }
      existingLangs.add(language.toLowerCase());
      next.languages.push({
        id: newId("lang"),
        language,
        proficiency: level,
        provenance: "imported-pending-review",
      });
      n += 1;
    }
    if (n > 0) applied.languages = n;
  }

  if (selections.projects) {
    let n = 0;
    const existingProjects = new Set(next.projects.map((p) => p.name.toLowerCase()));
    for (const proj of draft.projects) {
      const name = proj.name.trim().slice(0, 160);
      if (!name || existingProjects.has(name.toLowerCase())) continue;
      existingProjects.add(name.toLowerCase());
      const url = /^https?:\/\/\S+$/.test(proj.url) ? proj.url : "";
      next.projects.push({
        id: newId("proj"),
        name,
        url,
        description: proj.description.slice(0, 3000),
        technologies: proj.technologies.map((t) => t.slice(0, 80)).slice(0, 40),
        role: "",
        startDate: "",
        endDate: "",
        provenance: "imported-pending-review",
      });
      n += 1;
    }
    if (n > 0) applied.projects = n;
  }

  if (selections.certifications) {
    let n = 0;
    const existingCerts = new Set(next.certifications.map((c) => c.name.toLowerCase()));
    for (const cert of draft.certifications) {
      const name = cert.name.trim().slice(0, 200);
      if (!name || existingCerts.has(name.toLowerCase())) continue;
      existingCerts.add(name.toLowerCase());
      next.certifications.push({
        id: newId("cert"),
        name,
        issuer: cert.issuer.trim().slice(0, 200),
        issuedDate: cert.issuedDate ? normaliseCvDate(cert.issuedDate) ?? "" : "",
        expiresDate: "",
        credentialUrl: "",
        provenance: "imported-pending-review",
      });
      n += 1;
    }
    if (n > 0) applied.certifications = n;
  }

  next.updatedAt = nowIso;
  return { profile: next, applied, conflicts, skipped };
}

/** Count how many draft facts each section would contribute (for the review UI). */
export function draftSectionCounts(draft: CvProfileDraft): Record<CvMergeSection, number> {
  let contactFilled = 0;
  for (const v of Object.values(draft.contact)) {
    if (typeof v === "string") {
      if (v.trim()) contactFilled += 1;
    } else if (Array.isArray(v)) {
      contactFilled += v.filter((x) => typeof x === "string" && x.trim()).length;
    }
  }
  return {
    contact: contactFilled,
    summary: draft.professionalSummary.trim() ? 1 : 0,
    workExperience: draft.workExperience.length,
    education: draft.education.length,
    skills: draft.skills.length,
    languages: draft.languages.length,
    projects: draft.projects.length,
    certifications: draft.certifications.length,
  };
}
