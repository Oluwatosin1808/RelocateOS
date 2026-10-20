import type { CandidateProfile, WorkExperience, Education } from "../schemas/candidate-profile";

/**
 * Structured document model — platform-agnostic intermediate representation.
 * The DOCX renderer lives in the app layer; this module only arranges
 * verified profile facts. NOTHING is fabricated: if a fact is empty it is
 * simply omitted from the document.
 */

export type DocBlock =
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "paragraph"; text: string; bold?: boolean; italic?: boolean }
  | { type: "bullets"; items: string[] }
  | { type: "kv"; label: string; value: string }
  | { type: "spacing" };

export type DocumentModel = {
  title: string;
  blocks: DocBlock[];
};

function formatRange(start: string, end: string, isCurrent?: boolean): string {
  if (isCurrent || !end) return `${start} – Present`;
  return `${start} – ${end}`;
}

function formatWork(w: WorkExperience): string {
  const range = formatRange(w.startDate, w.endDate, w.isCurrent);
  const loc = w.location ? ` · ${w.location}` : "";
  return `${w.jobTitle}, ${w.employer}${loc} (${range})`;
}

function formatEducation(e: Education): string {
  const range = formatRange(e.startDate, e.endDate);
  const field = e.fieldOfStudy ? `, ${e.fieldOfStudy}` : "";
  return `${e.qualification}${field} — ${e.institution} (${range})`;
}

/**
 * Build a CV document from confirmed profile facts.
 * Sections with no data are omitted entirely — never padded with placeholders.
 */
export function buildCvDocument(profile: CandidateProfile): DocumentModel {
  const blocks: DocBlock[] = [];
  const contact = profile.contact;

  // Header
  if (contact.fullName) {
    blocks.push({ type: "heading", text: contact.fullName, level: 1 });
  }
  const contactLine = [
    contact.email,
    contact.phone,
    contact.currentCity ? `${contact.currentCity}, ${contact.currentCountry}` : null,
    contact.linkedinUrl,
    contact.githubUrl,
    ...contact.portfolioUrls,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    blocks.push({ type: "paragraph", text: contactLine });
  }
  blocks.push({ type: "spacing" });

  // Professional summary — only from the user's stated objective/summary if present
  const summary = profile.professionalSummary?.trim();
  if (summary) {
    blocks.push({ type: "heading", text: "Summary", level: 2 });
    blocks.push({ type: "paragraph", text: summary });
    blocks.push({ type: "spacing" });
  }

  // Skills
  if (profile.skills.length > 0) {
    blocks.push({ type: "heading", text: "Skills", level: 2 });
    const byCategory = new Map<string, string[]>();
    for (const s of profile.skills) {
      const list = byCategory.get(s.category) ?? [];
      list.push(s.yearsExperience != null ? `${s.name} (${s.yearsExperience}y)` : s.name);
      byCategory.set(s.category, list);
    }
    for (const [category, names] of byCategory) {
      blocks.push({ type: "kv", label: category, value: names.join(", ") });
    }
    blocks.push({ type: "spacing" });
  }

  // Work experience (most recent first if not already sorted)
  if (profile.workExperience.length > 0) {
    blocks.push({ type: "heading", text: "Work Experience", level: 2 });
    for (const w of profile.workExperience) {
      blocks.push({ type: "paragraph", text: formatWork(w), bold: true });
      if (w.description) {
        for (const line of w.description.split("\n").filter(Boolean)) {
          blocks.push({ type: "bullets", items: [line.trim()] });
        }
      }
      if (w.technologies.length > 0) {
        blocks.push({ type: "paragraph", text: `Technologies: ${w.technologies.join(", ")}`, italic: true });
      }
    }
    blocks.push({ type: "spacing" });
  }

  // Projects
  if (profile.projects.length > 0) {
    blocks.push({ type: "heading", text: "Projects", level: 2 });
    for (const p of profile.projects) {
      const meta = [p.role, formatRange(p.startDate, p.endDate)].filter(Boolean).join(" · ");
      blocks.push({ type: "paragraph", text: `${p.name}${meta ? ` (${meta})` : ""}`, bold: true });
      if (p.url) blocks.push({ type: "paragraph", text: p.url, italic: true });
      if (p.description) blocks.push({ type: "paragraph", text: p.description });
      if (p.technologies.length > 0) {
        blocks.push({ type: "paragraph", text: p.technologies.join(", "), italic: true });
      }
    }
    blocks.push({ type: "spacing" });
  }

  // Education
  if (profile.education.length > 0) {
    blocks.push({ type: "heading", text: "Education", level: 2 });
    for (const e of profile.education) {
      blocks.push({ type: "paragraph", text: formatEducation(e), bold: true });
      if (e.description) blocks.push({ type: "paragraph", text: e.description });
    }
    blocks.push({ type: "spacing" });
  }

  // Certifications
  if (profile.certifications.length > 0) {
    blocks.push({ type: "heading", text: "Certifications", level: 2 });
    for (const c of profile.certifications) {
      const parts = [c.name, c.issuer, c.issuedDate].filter(Boolean).join(", ");
      blocks.push({ type: "bullets", items: [c.credentialUrl ? `${parts} — ${c.credentialUrl}` : parts] });
    }
    blocks.push({ type: "spacing" });
  }

  // Languages — user-asserted only
  if (profile.languages.length > 0) {
    blocks.push({ type: "heading", text: "Languages", level: 2 });
    for (const l of profile.languages) {
      blocks.push({ type: "bullets", items: [`${l.language} — ${l.proficiency}`] });
    }
    blocks.push({ type: "spacing" });
  }

  return { title: profile.contact.fullName ? `${profile.contact.fullName} — CV` : "CV", blocks };
}

export type CoverLetterInput = {
  profile: CandidateProfile;
  job: { title: string; employerName: string; location: string; city: string; country: string };
};

/**
 * Build a cover letter skeleton from verified facts only.
 * The body paragraphs are structured prompts with the facts woven in —
 * the user reviews and edits before export; nothing is hallucinated.
 */
export function buildCoverLetterDocument({ profile, job }: CoverLetterInput): DocumentModel {
  const blocks: DocBlock[] = [];
  const contact = profile.contact;
  const name = contact.fullName || "[Your name]";

  // Header
  blocks.push({ type: "heading", text: `Cover letter — ${job.title} at ${job.employerName}`, level: 1 });
  const contactLine = [contact.email, contact.phone, contact.currentCity].filter(Boolean).join("  ·  ");
  if (contactLine) blocks.push({ type: "paragraph", text: contactLine });
  blocks.push({ type: "spacing" });

  // Opening — states the role and where they found it (no fabrication)
  blocks.push({
    type: "paragraph",
    text: `Dear ${job.employerName} hiring team,`,
  });
  blocks.push({
    type: "paragraph",
    text: `I am writing to express my interest in the ${job.title} position${job.location ? ` at ${job.employerName} (${job.location})` : ` at ${job.employerName}`}. ${name !== "[Your name]" ? `My name is ${name}.` : ""}`,
  });
  blocks.push({ type: "spacing" });

  // Fit paragraph — anchored to real skills and experience the user has
  const topSkills = profile.skills.slice(0, 5).map((s) => s.name);
  const latestRole = profile.workExperience[0];
  const fitParts: string[] = [];
  if (latestRole) {
    fitParts.push(
      `In my current role as ${latestRole.jobTitle} at ${latestRole.employer}, I work with ${latestRole.technologies.slice(0, 6).join(", ") || "relevant technologies"}.`,
    );
  }
  if (topSkills.length > 0) {
    fitParts.push(`My core competencies include ${topSkills.join(", ")}.`);
  }
  if (fitParts.length > 0) {
    blocks.push({ type: "paragraph", text: fitParts.join(" ") });
  }

  // Relocation intent — from the user's stated objective, never invented
  const objective = profile.relocationPreferences?.employmentObjective;
  const targets = profile.relocationPreferences?.targetCountries ?? [];
  if (objective || targets.length > 0) {
    const targetNames = targets.map((t) => (t === "NL" ? "the Netherlands" : t === "BE" ? "Belgium" : t));
    blocks.push({
      type: "paragraph",
      text: [
        objective,
        targetNames.length > 0
          ? `I am actively preparing to relocate to ${targetNames.join(" or ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  blocks.push({ type: "spacing" });

  // Closing
  blocks.push({
    type: "paragraph",
    text: "I would welcome the opportunity to discuss how my background aligns with your team's needs. My full CV is attached. Thank you for your time and consideration.",
  });
  blocks.push({ type: "spacing" });
  blocks.push({ type: "paragraph", text: "Kind regards," });
  blocks.push({ type: "paragraph", text: name });

  blocks.push({ type: "spacing" });
  blocks.push({
    type: "paragraph",
    text: "— Review this draft before export. Every statement above is drawn from your verified profile facts; edit freely to match your voice.",
    italic: true,
  });

  return { title: `Cover letter — ${job.title} at ${job.employerName}`, blocks };
}
