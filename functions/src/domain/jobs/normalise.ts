import type {
  ApplicationMethod,
  CountryCode,
  NormalisedJobDraft,
  WorkplaceType,
} from "../schemas/job";
import { parseSalary } from "./salary";
import { jobContentHash } from "./hash";

/** Infer a coarse country code from free-text location. NL/BE focus; honest OTHER. */
export function inferCountry(location: string): CountryCode {
  const t = location.toLowerCase();
  if (
    /\bnetherlands?\b|\bthe netherlands\b|\bholland\b|\bamsterdam\b|\brotterdam\b|\butrecht\b|\beindhoven\b|\bdelft\b|\bleiden\b|\bthe hague\b|\bs-hertogenbosch\b|\bgroningen\b|\bnederland\b|\bnl\b/.test(
      t,
    )
  ) {
    return "NL";
  }
  if (
    /\bbelgium\b|\bbelgië\b|\bbrussels?\b|\bbruxelles\b|\bantwerp\b|\bantwerpen\b|\bghent\b|\bgent\b|\bleuven\b|\bflanders?\b|\bwallonia\b|\bliège\b|\bmechelen\b|\bkortrijk\b|\bbe\b/.test(
      t,
    )
  ) {
    return "BE";
  }
  return "OTHER";
}

export function inferWorkplaceType(text: string): WorkplaceType {
  const t = text.toLowerCase();
  // Order matters: explicit hybrid beats remote keyword in boilerplate.
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bremote\b|work from home|fully distributed/.test(t)) return "remote";
  if (/\bon-?site\b|in-?office|on office/.test(t)) return "onsite";
  return "unspecified";
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export function parseLooseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const iso = input.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso?.[1]) return `${iso[1]}T00:00:00.000Z`;
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

/** Very light skill extraction from a description (deterministic; AI refines later). */
const SKILL_PATTERNS: { re: RegExp; name: string }[] = [
  { re: /\breact(?:\.js)?\b/i, name: "React" },
  { re: /\bnext\.?js\b/i, name: "Next.js" },
  { re: /\btypescript\b/i, name: "TypeScript" },
  { re: /\bjavascript\b/i, name: "JavaScript" },
  { re: /\bhtml5?\b/i, name: "HTML" },
  { re: /\bcss3?\b|sass|scss|tailwind/i, name: "CSS" },
  { re: /\bfigma\b/i, name: "Figma" },
  { re: /\bui\/ux\b|\bux design\b|\bui design\b/i, name: "UI/UX" },
  { re: /\bdesign system/i, name: "Design systems" },
  { re: /\baccessibility\b|\bwcag\b|\ba11y\b/i, name: "Accessibility" },
  { re: /\bbubble\b/i, name: "Bubble" },
  { re: /\bwebflow\b/i, name: "Webflow" },
  { re: /\blow-?code\b|\bno-?code\b/i, name: "Low-code/No-code" },
  { re: /\bopenai\b|\bgpt-?\d|\bllm\b|\blarge language model/i, name: "LLM integrations" },
  { re: /\bapi integration|\brest\b|\bgraphql\b/i, name: "API integrations" },
  { re: /\bsupabase\b/i, name: "Supabase" },
  { re: /\bfirebase\b/i, name: "Firebase" },
  { re: /\bsql\b|postgres|mysql/i, name: "SQL" },
  { re: /\bnode\.?js\b/i, name: "Node.js" },
  { re: /\bvue\b/i, name: "Vue" },
  { re: /\bsvelte\b/i, name: "Svelte" },
  { re: /\bpython\b/i, name: "Python" },
  { re: /\baccessibility\b/i, name: "Accessibility" },
];

export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const { re, name } of SKILL_PATTERNS) {
    if (re.test(text)) found.add(name);
  }
  return [...found];
}

export function extractLanguageRequirements(text: string): string[] {
  const reqs: string[] = [];
  if (/\benglish\b/i.test(text)) reqs.push("English");
  if (/\bdutch\b|\bnederlands\b/i.test(text)) reqs.push("Dutch");
  if (/\bfrench\b|\bfrançais\b|\bfrench\b/i.test(text)) reqs.push("French");
  if (/\bgerman\b/i.test(text)) reqs.push("German");
  return reqs;
}

export function extractSalaryText(htmlOrText: string): string {
  const text = htmlOrText.replace(/<[^>]+>/g, " ");
  const match = text.match(
    /(?:salary|compensation|remuneration|gross|€|EUR)\s*[:\-–]?\s*.{0,80}(?:€|EUR|per|year|month|hour|annual|\d)/i,
  );
  if (match?.[0]) return match[0].replace(/\s+/g, " ").trim().slice(0, 200);
  const euro = text.match(/[€]\s*[\d.,]+\s*(?:[-–—]\s*[€]?\s*[\d.,]+)?(?:\s*(?:per|p\.a\.|monthly|annual|year|month))?/i);
  return euro?.[0]?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Raw Greenhouse Job Board API job object. */
export type RawGreenhouseJob = {
  id: number | string;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
  content?: string;
  departments?: { name?: string }[];
  offices?: { name?: string }[];
};

export function normaliseGreenhouseJob(
  raw: RawGreenhouseJob,
  ctx: { sourceId: string; boardToken: string },
): NormalisedJobDraft {
  const descriptionHtml = raw.content ?? "";
  const description = stripHtml(descriptionHtml);
  const locationName = raw.location?.name ?? raw.offices?.[0]?.name ?? "";
  const salaryRaw = extractSalaryText(descriptionHtml || description);
  const salary = parseSalary(salaryRaw);
  const departmentNames = (raw.departments ?? [])
    .map((d) => d.name ?? "")
    .filter(Boolean);
  const publicUrl = `https://boards.greenhouse.io/${ctx.boardToken}/jobs/${raw.id}`;

  return {
    sourceId: ctx.sourceId,
    provider: "greenhouse",
    sourceJobId: String(raw.id),
    employerName: ctx.boardToken,
    employerDomain: "",
    title: raw.title.trim(),
    description: description.slice(0, 20000),
    descriptionHtml: descriptionHtml.slice(0, 60000),
    location: locationName,
    city: locationName.split(",")[0]?.trim() ?? "",
    country: inferCountry(locationName),
    region: "",
    workplaceType: inferWorkplaceType(`${raw.title} ${description}`),
    employmentType: "full-time",
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salaryMonthlyEurMin: salary.monthlyEurMin,
    salaryMonthlyEurMax: salary.monthlyEurMax,
    salaryDisclosure: salary.min === null && salary.max === null ? "undisclosed" : "disclosed",
    salaryRaw: salaryRaw || salaryRaw,
    languageRequirements: extractLanguageRequirements(description),
    requiredSkills: extractSkills(description),
    preferredSkills: [],
    publishedAt: parseLooseDate(raw.first_published ?? raw.updated_at ?? null),
    expiresAt: null,
    applicationUrl: raw.absolute_url || publicUrl,
    canonicalUrl: publicUrl,
    applicationMethod: "external_apply",
    contentHash: jobContentHash({
      employerName: ctx.boardToken,
      title: raw.title,
      location: locationName,
      description,
    }),
    raw: {
      departments: departmentNames,
      greenhouseId: raw.id,
    },
  };
}

/** Raw Lever Posting API posting object. */
export type RawLeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  categories?: { location?: string; commitment?: string; team?: string; department?: string };
  description?: string;
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  createdAt?: number;
  workplaceType?: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
};

export function normaliseLeverJob(
  raw: RawLeverPosting,
  ctx: { sourceId: string; company: string },
): NormalisedJobDraft {
  const descriptionPlain =
    raw.descriptionPlain ??
    [raw.description ?? "", ...(raw.lists ?? []).map((l) => l.content ?? l.text ?? "")]
      .join("\n\n");
  const description = descriptionPlain.slice(0, 20000);
  const locationName = raw.categories?.location ?? "";
  const salaryRaw =
    raw.salaryRange?.min != null
      ? `${raw.salaryRange.min} - ${raw.salaryRange.max ?? ""} ${raw.salaryRange.currency ?? ""}`.trim()
      : extractSalaryText(description);
  const salary = parseSalary(salaryRaw);
  const publishedAt =
    typeof raw.createdAt === "number"
      ? new Date(raw.createdAt).toISOString()
      : null;

  const workplace: WorkplaceType =
    raw.workplaceType === "remote"
      ? "remote"
      : raw.workplaceType === "hybrid"
        ? "hybrid"
        : raw.workplaceType === "on_site"
          ? "onsite"
          : inferWorkplaceType(`${raw.text} ${description}`);

  return {
    sourceId: ctx.sourceId,
    provider: "lever",
    sourceJobId: raw.id,
    employerName: ctx.company,
    employerDomain: "",
    title: raw.text.trim(),
    description,
    descriptionHtml: "",
    location: locationName,
    city: locationName.split(",")[0]?.trim() ?? "",
    country: inferCountry(locationName),
    region: "",
    workplaceType: workplace,
    employmentType: raw.categories?.commitment ?? "unknown",
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency ?? raw.salaryRange?.currency ?? null,
    salaryMonthlyEurMin: salary.monthlyEurMin,
    salaryMonthlyEurMax: salary.monthlyEurMax,
    salaryDisclosure: salary.min == null && salary.max == null ? "undisclosed" : "disclosed",
    salaryRaw,
    languageRequirements: extractLanguageRequirements(description),
    requiredSkills: extractSkills(description),
    preferredSkills: [],
    publishedAt,
    expiresAt: null,
    applicationUrl: raw.applyUrl || raw.hostedUrl,
    canonicalUrl: raw.hostedUrl,
    applicationMethod: "external_apply",
    contentHash: jobContentHash({
      employerName: ctx.company,
      title: raw.text,
      location: locationName,
      description,
    }),
    raw: { leverCategories: raw.categories ?? null },
  };
}
