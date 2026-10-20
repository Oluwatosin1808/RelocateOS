import type { CandidateProfile } from "../schemas/candidate-profile";
import type { Job } from "../schemas/job";

/**
 * Job scoring: deterministic, explainable score 0–100 comparing a job against
 * the candidate profile. Every component is a named contribution so the UI can
 * show *why* a job scored what it did. No AI, no guessing — only field-level
 * comparisons against confirmed profile facts.
 *
 * Components (weights sum to 100):
 *   skills        30  — required/preferred skills vs profile skill pool + role family tech
 *   salary        25  — monthly EUR floor vs disclosed salary
 *   roleFamily    20  — title/synonym match against enabled role families
 *   country       10  — job country vs relocation target countries
 *   workplace     10  — job workplace type vs preferred workplace types
 *   sponsorship   5   — keyword hints (not a legal determination)
 */

export type ScoreComponent = {
  key: "skills" | "salary" | "roleFamily" | "country" | "workplace" | "sponsorship";
  label: string;
  score: number;
  max: number;
  detail: string;
};

export type JobScore = {
  total: number;
  components: ScoreComponent[];
  /** ISO timestamp of when this score was computed. */
  scoredAt: string;
};

const WEIGHTS = {
  skills: 30,
  salary: 25,
  roleFamily: 20,
  country: 10,
  workplace: 10,
  sponsorship: 5,
} as const;

function normaliseToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normaliseToken(s)
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function scoreSkills(job: Job, profile: CandidateProfile): ScoreComponent {
  const profileSkills = new Set<string>();
  for (const s of profile.skills) profileSkills.add(normaliseToken(s.name));
  for (const s of profile.searchPreferences.skillsKeywordPool) {
    profileSkills.add(normaliseToken(s));
  }
  for (const family of profile.searchPreferences.roleFamilies) {
    if (!family.enabled) continue;
    for (const t of family.technologies) profileSkills.add(normaliseToken(t));
  }

  const jobSkills = [
    ...job.requiredSkills.map((s) => ({ token: normaliseToken(s), required: true })),
    ...job.preferredSkills.map((s) => ({ token: normaliseToken(s), required: false })),
  ];

  if (jobSkills.length === 0) {
    return {
      key: "skills",
      label: "Skills match",
      score: Math.round(WEIGHTS.skills * 0.5),
      max: WEIGHTS.skills,
      detail: "Job lists no specific skills — neutral score.",
    };
  }

  let hits = 0;
  let requiredHits = 0;
  let requiredCount = 0;
  for (const { token, required } of jobSkills) {
    if (required) requiredCount += 1;
    // Substring or exact token match against profile skill set.
    let matched = profileSkills.has(token);
    if (!matched) {
      for (const p of profileSkills) {
        if (p.includes(token) || token.includes(p)) {
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      hits += 1;
      if (required) requiredHits += 1;
    }
  }

  const hitRatio = hits / jobSkills.length;
  const requiredRatio = requiredCount > 0 ? requiredHits / requiredCount : hitRatio;
  // Weight required skills more heavily.
  const ratio = requiredCount > 0 ? requiredRatio * 0.7 + hitRatio * 0.3 : hitRatio;
  const score = Math.round(WEIGHTS.skills * ratio);

  return {
    key: "skills",
    label: "Skills match",
    score,
    max: WEIGHTS.skills,
    detail:
      requiredCount > 0
        ? `${requiredHits}/${requiredCount} required, ${hits}/${jobSkills.length} total skills matched.`
        : `${hits}/${jobSkills.length} preferred skills matched.`,
  };
}

function scoreSalary(job: Job, profile: CandidateProfile): ScoreComponent {
  const floor = profile.salaryPreferences.minGrossMonthlyEur;
  if (job.salaryMonthlyEurMin == null) {
    return {
      key: "salary",
      label: "Salary fit",
      score: Math.round(WEIGHTS.salary * 0.4),
      max: WEIGHTS.salary,
      detail: "Salary not disclosed — cannot confirm it meets your floor.",
    };
  }
  if (job.salaryMonthlyEurMin >= floor) {
    // Full marks at or above floor; bonus feel capped at max.
    const surplus = (job.salaryMonthlyEurMin - floor) / Math.max(floor, 1);
    const bonus = Math.min(0.15, surplus * 0.1);
    return {
      key: "salary",
      label: "Salary fit",
      score: Math.min(WEIGHTS.salary, Math.round(WEIGHTS.salary * (1 + bonus))),
      max: WEIGHTS.salary,
      detail: `€${job.salaryMonthlyEurMin.toLocaleString("en-GB")}/mo meets your €${floor.toLocaleString("en-GB")} floor.`,
    };
  }
  const ratio = job.salaryMonthlyEurMin / Math.max(floor, 1);
  return {
    key: "salary",
    label: "Salary fit",
    score: Math.round(WEIGHTS.salary * ratio * 0.6),
    max: WEIGHTS.salary,
    detail: `€${job.salaryMonthlyEurMin.toLocaleString("en-GB")}/mo is below your €${floor.toLocaleString("en-GB")} floor.`,
  };
}

function scoreRoleFamily(job: Job, profile: CandidateProfile): ScoreComponent {
  const enabled = profile.searchPreferences.roleFamilies.filter((f) => f.enabled);
  if (enabled.length === 0) {
    return {
      key: "roleFamily",
      label: "Role match",
      score: Math.round(WEIGHTS.roleFamily * 0.5),
      max: WEIGHTS.roleFamily,
      detail: "No role families configured — neutral score.",
    };
  }
  const titleTokens = tokenSet(job.title);
  let best = 0;
  let bestTitle = "";
  for (const family of enabled) {
    const familyTokens = new Set<string>([...tokenSet(family.title)]);
    for (const syn of family.synonyms) {
      for (const t of tokenSet(syn)) familyTokens.add(t);
    }
    // Excluded titles veto this family.
    let excluded = false;
    const jobTitleLower = job.title.toLowerCase();
    for (const ex of family.excludedTitles) {
      if (ex && jobTitleLower.includes(ex.toLowerCase())) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    const sim = jaccard(titleTokens, familyTokens);
    if (sim > best) {
      best = sim;
      bestTitle = family.title;
    }
  }
  const score = Math.round(WEIGHTS.roleFamily * best);
  return {
    key: "roleFamily",
    label: "Role match",
    score,
    max: WEIGHTS.roleFamily,
    detail:
      best > 0
        ? `Closest match: ${bestTitle} (${Math.round(best * 100)}% title overlap).`
        : "No role-family title overlap.",
  };
}

function scoreCountry(job: Job, profile: CandidateProfile): ScoreComponent {
  const targets = profile.relocationPreferences.targetCountries as string[];
  if (targets.length === 0) {
    return {
      key: "country",
      label: "Country",
      score: Math.round(WEIGHTS.country * 0.5),
      max: WEIGHTS.country,
      detail: "No target countries configured.",
    };
  }
  if (targets.includes(job.country)) {
    return {
      key: "country",
      label: "Country",
      score: WEIGHTS.country,
      max: WEIGHTS.country,
      detail: `${job.country} is one of your target countries.`,
    };
  }
  return {
    key: "country",
    label: "Country",
    score: 0,
    max: WEIGHTS.country,
    detail: `${job.country} is outside your target countries (${targets.join(", ")}).`,
  };
}

function scoreWorkplace(job: Job, profile: CandidateProfile): ScoreComponent {
  const preferred = profile.relocationPreferences.workplaceTypes;
  if (preferred.length === 0 || job.workplaceType === "unspecified") {
    return {
      key: "workplace",
      label: "Workplace",
      score: Math.round(WEIGHTS.workplace * 0.5),
      max: WEIGHTS.workplace,
      detail: job.workplaceType === "unspecified" ? "Workplace not specified." : "No workplace preference set.",
    };
  }
  if (preferred.includes(job.workplaceType)) {
    return {
      key: "workplace",
      label: "Workplace",
      score: WEIGHTS.workplace,
      max: WEIGHTS.workplace,
      detail: `${job.workplaceType} matches your preference.`,
    };
  }
  return {
    key: "workplace",
    label: "Workplace",
    score: Math.round(WEIGHTS.workplace * 0.3),
    max: WEIGHTS.workplace,
    detail: `${job.workplaceType} is not in your preferred types (${preferred.join(", ")}).`,
  };
}

function scoreSponsorship(job: Job, profile: CandidateProfile): ScoreComponent {
  // Keyword hint only — NEVER a legal determination. The sponsorship module
  // (Phase 3) produces the actual assessment.
  const haystack = `${job.title} ${job.description} ${job.descriptionHtml}`.toLowerCase();
  const keywords = profile.searchPreferences.sponsorshipKeywords;
  const hits = keywords.filter((k) => haystack.includes(k.toLowerCase()));
  if (hits.length > 0) {
    return {
      key: "sponsorship",
      label: "Sponsorship hint",
      score: WEIGHTS.sponsorship,
      max: WEIGHTS.sponsorship,
      detail: `Mentions: ${hits.slice(0, 3).join(", ")} — keyword hint only, not a legal determination.`,
    };
  }
  if (profile.workAuthorisation.requiresEmployerSponsorship) {
    return {
      key: "sponsorship",
      label: "Sponsorship hint",
      score: Math.round(WEIGHTS.sponsorship * 0.3),
      max: WEIGHTS.sponsorship,
      detail: "No sponsorship keywords found — you need sponsorship, so verify before applying.",
    };
  }
  return {
    key: "sponsorship",
    label: "Sponsorship hint",
    score: Math.round(WEIGHTS.sponsorship * 0.7),
    max: WEIGHTS.sponsorship,
    detail: "You do not require sponsorship; keyword absence is not a concern.",
  };
}

/**
 * Compute a full explainable score for a job against a profile.
 * Deterministic: same inputs → same score.
 */
export function scoreJob(job: Job, profile: CandidateProfile): JobScore {
  const components: ScoreComponent[] = [
    scoreSkills(job, profile),
    scoreSalary(job, profile),
    scoreRoleFamily(job, profile),
    scoreCountry(job, profile),
    scoreWorkplace(job, profile),
    scoreSponsorship(job, profile),
  ];
  const total = components.reduce((sum, c) => sum + c.score, 0);
  return {
    total: Math.max(0, Math.min(100, total)),
    components,
    scoredAt: new Date().toISOString(),
  };
}

/** Quick 0–100 without component breakdown (for list views). */
export function scoreJobTotal(job: Job, profile: CandidateProfile): number {
  return scoreJob(job, profile).total;
}
