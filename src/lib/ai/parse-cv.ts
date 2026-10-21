import "server-only";
import { chatComplete, isAiConfigured, AiUnavailableError, AiCallError } from "@/lib/ai/client";
import {
  parseCvDraft,
  cvProfileDraftSchema,
  normaliseUrl,
  type CvProfileDraft,
} from "@domain/profile/cv-draft";

/**
 * CV → structured profile draft.
 *
 * Primary path: AI (configured OpenAI-compatible provider) with a strict
 * "extract only what is literally present" JSON contract, validated against
 * the same domain schema the deterministic parser produces. When AI is not
 * configured or fails (rate limit, bad JSON), we fall back to the
 * deterministic extractor and say so — never silently, never fabricated.
 */

export type CvParseResult = {
  source: "ai" | "deterministic";
  draft: CvProfileDraft;
  /** Why AI was not used, or null when AI produced the draft. */
  aiReason: string | null;
  model: string | null;
  textChars: number;
};

const SYSTEM_PROMPT = `You extract structured profile data from raw CV/resume text.

STRICT RULES:
- Extract ONLY what is literally written in the CV. Never invent, guess, or complete missing facts. Missing fields are "" and missing arrays are [].
- Output ONLY a JSON object (no markdown fences, no commentary) matching EXACTLY this shape:
{
  "contact": {"fullName": "", "email": "", "phone": "", "currentCity": "", "currentCountry": "", "nationality": "", "linkedinUrl": "", "githubUrl": ""},
  "professionalSummary": "",
  "workExperience": [{"jobTitle":"","employer":"","location":"","startDate":"YYYY-MM or YYYY or empty","endDate":"YYYY-MM or YYYY or empty","isCurrent":false,"description":"","technologies":[]}],
  "education": [{"institution":"","qualification":"","fieldOfStudy":"","startDate":"","endDate":"","grade":""}],
  "skills": [{"name":""}],
  "languages": [{"language":"","proficiency":"basic|conversational|professional|fluent|native|only when literally stated, else empty"}],
  "projects": [{"name":"","description":"","technologies":[],"url":""}],
  "certifications": [{"name":"","issuer":"","issuedDate":""}]
}
- Dates: convert to "YYYY-MM" or "YYYY". If the CV says "Present/Current", set endDate "" and isCurrent true.
- description: join the role's bullet points with newlines. Keep only bullets literally under that role.
- employmentType is not part of the output.
- professionalSummary: only the CV's own summary/objective section text, condensed to <=2000 chars; "" if none.`;

/** Merge deterministic facts into AI gaps (AI misses nothing twice). */
function fillGaps(ai: CvProfileDraft, det: CvProfileDraft): CvProfileDraft {
  const merged: CvProfileDraft = structuredClone(ai);
  for (const key of Object.keys(merged.contact) as (keyof CvProfileDraft["contact"])[]) {
    if (!merged.contact[key]) merged.contact[key] = det.contact[key];
  }
  if (!merged.professionalSummary) merged.professionalSummary = det.professionalSummary;
  if (merged.workExperience.length === 0) merged.workExperience = det.workExperience;
  if (merged.education.length === 0) merged.education = det.education;
  if (merged.skills.length === 0) merged.skills = det.skills;
  if (merged.languages.length === 0) merged.languages = det.languages;
  if (merged.projects.length === 0) merged.projects = det.projects;
  if (merged.certifications.length === 0) merged.certifications = det.certifications;
  return merged;
}

function stripFences(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1]! : trimmed;
}

export async function parseCvProfile(text: string): Promise<CvParseResult> {
  const truncated = text.slice(0, 15000);
  const det = parseCvDraft(text);

  if (!isAiConfigured()) {
    return {
      source: "deterministic",
      draft: det,
      aiReason: "No AI provider configured — used deterministic extraction (contact, skills, sections). Set AI_PROVIDER + AI_API_KEY for full parsing.",
      model: null,
      textChars: text.length,
    };
  }

  try {
    const result = await chatComplete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `CV TEXT:\n${truncated}` },
      ],
      { temperature: 0, maxTokens: 4096 },
    );
    const json = JSON.parse(stripFences(result.content)) as unknown;
    const parsed = cvProfileDraftSchema.safeParse(json);
    if (!parsed.success) {
      return {
        source: "deterministic",
        draft: det,
        aiReason: "AI returned data that failed schema validation — used deterministic extraction instead.",
        model: result.model,
        textChars: text.length,
      };
    }
    const draft = fillGaps(parsed.data, det);
    // AI often echoes bare domains — make them schema-valid URLs
    if (draft.contact.linkedinUrl) draft.contact.linkedinUrl = normaliseUrl(draft.contact.linkedinUrl);
    if (draft.contact.githubUrl) draft.contact.githubUrl = normaliseUrl(draft.contact.githubUrl);
    return {
      source: "ai",
      draft,
      aiReason: null,
      model: result.model,
      textChars: text.length,
    };
  } catch (err) {
    const reason =
      err instanceof AiUnavailableError
        ? `AI unavailable: ${err.message} — used deterministic extraction.`
        : err instanceof AiCallError
          ? `AI call failed (${err.status ?? "network"}): ${err.message.slice(0, 200)} — used deterministic extraction.`
          : err instanceof SyntaxError
            ? "AI returned invalid JSON — used deterministic extraction."
            : `CV parse failed: ${err instanceof Error ? err.message : String(err)} — used deterministic extraction.`;
    return {
      source: "deterministic",
      draft: det,
      aiReason: reason,
      model: null,
      textChars: text.length,
    };
  }
}
