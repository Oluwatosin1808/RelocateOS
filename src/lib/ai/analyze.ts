import "server-only";
import { chatComplete, isAiConfigured, AiUnavailableError } from "@/lib/ai/client";
import type { Job } from "@domain/schemas/job";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";

/**
 * AI-assisted job analysis — optional enhancement on top of the deterministic
 * score. When no AI provider is configured, `analyzeJob` returns
 * `{ available: false }` and the UI falls back to the rule-based score only.
 * Nothing is ever fabricated.
 */

export type AiJobAnalysis = {
  available: true;
  summary: string;
  matchReasons: string[];
  concerns: string[];
  salaryContext: string;
  model: string;
  totalTokens: number | null;
};

export type AiAnalysisUnavailable = {
  available: false;
  reason: string;
};

export type AiAnalysisResult = AiJobAnalysis | AiAnalysisUnavailable;

function profileFacts(p: CandidateProfile): string {
  const parts: string[] = [];
  if (p.contact.fullName) parts.push(`Name: ${p.contact.fullName}`);
  if (p.professionalSummary) parts.push(`Summary: ${p.professionalSummary.slice(0, 400)}`);
  if (p.workExperience.length > 0) {
    parts.push(
      `Recent experience: ${p.workExperience
        .slice(0, 3)
        .map((w) => `${w.jobTitle} at ${w.employer} (${w.startDate}${w.endDate ? `–${w.endDate}` : w.isCurrent ? "–present" : ""})`)
        .join("; ")}`,
    );
  }
  if (p.skills.length > 0) {
    parts.push(`Skills: ${p.skills.slice(0, 20).map((s) => s.name).join(", ")}`);
  }
  if (p.salaryPreferences) {
    parts.push(
      `Salary preference: min €${p.salaryPreferences.minGrossMonthlyEur}/month`,
    );
  }
  if (p.relocationPreferences.targetCountries.length > 0) {
    parts.push(`Target countries: ${p.relocationPreferences.targetCountries.join(", ")}`);
  }
  if (p.searchPreferences.roleFamilies.length > 0) {
    parts.push(`Target roles: ${p.searchPreferences.roleFamilies.map((r) => r.title).join(", ")}`);
  }
  return parts.join("\n");
}

function jobFacts(j: Job): string {
  const parts: string[] = [];
  parts.push(`Title: ${j.title}`);
  parts.push(`Employer: ${j.employerName}`);
  parts.push(`Location: ${j.location || "unspecified"} (${j.country})`);
  parts.push(`Workplace: ${j.workplaceType}`);
  parts.push(`Employment: ${j.employmentType}`);
  if (j.salaryMonthlyEurMin || j.salaryMonthlyEurMax) {
    parts.push(
      `Salary: €${j.salaryMonthlyEurMin ?? "?"}–€${j.salaryMonthlyEurMax ?? "?"}/month`,
    );
  } else {
    parts.push("Salary: undisclosed");
  }
  if (j.requiredSkills.length > 0) {
    parts.push(`Required skills: ${j.requiredSkills.join(", ")}`);
  }
  if (j.preferredSkills.length > 0) {
    parts.push(`Preferred skills: ${j.preferredSkills.join(", ")}`);
  }
  if (j.languageRequirements.length > 0) {
    parts.push(`Languages: ${j.languageRequirements.join(", ")}`);
  }
  parts.push(`Description (truncated):\n${j.description.slice(0, 2500)}`);
  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are a career analyst helping a candidate relocating from Nigeria to Europe evaluate job postings.

Rules:
- Base your analysis ONLY on the facts provided. Never invent requirements, benefits, or employer details that are not stated.
- Be concise and specific.
- If salary is undisclosed, say so — do not estimate.
- Match reasons must reference concrete skills or experience from the candidate's profile.
- Concerns must reference concrete gaps or risks (visa, salary, seniority mismatch, missing skills).
- Respond in strict JSON with keys: summary (string), matchReasons (array of strings), concerns (array of strings), salaryContext (string).`;

/**
 * Analyse a job against a profile using the configured AI provider.
 * Returns `{ available: false }` when no AI is configured or the call fails —
 * the caller should fall back to the deterministic score.
 */
export async function analyzeJob(
  job: Job,
  profile: CandidateProfile,
): Promise<AiAnalysisResult> {
  if (!isAiConfigured()) {
    return { available: false, reason: "AI provider is not configured." };
  }

  const userPrompt = `CANDIDATE PROFILE:\n${profileFacts(profile)}\n\nJOB POSTING:\n${jobFacts(job)}\n\nAnalyse this job match and respond in the required JSON format.`;

  try {
    const result = await chatComplete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 800 },
    );

    // Parse JSON — strip markdown fences if present.
    const raw = result.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(raw) as {
      summary?: string;
      matchReasons?: string[];
      concerns?: string[];
      salaryContext?: string;
    };

    return {
      available: true,
      summary: (parsed.summary ?? "").slice(0, 1000),
      matchReasons: (parsed.matchReasons ?? []).slice(0, 8).map((s) => s.slice(0, 300)),
      concerns: (parsed.concerns ?? []).slice(0, 8).map((s) => s.slice(0, 300)),
      salaryContext: (parsed.salaryContext ?? "").slice(0, 500),
      model: result.model,
      totalTokens: result.totalTokens,
    };
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return { available: false, reason: "AI provider is not configured." };
    }
    return {
      available: false,
      reason: err instanceof Error ? err.message : "AI analysis failed.",
    };
  }
}
