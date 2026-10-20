import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { MockAtsAdapter } from "./mock-ats";
import type { JobSourceAdapter } from "./types";
import type { JobSource } from "../domain/schemas/job";
import type { CandidateProfile } from "../domain/schemas/candidate-profile";
import type { JobSearchQuery } from "../domain/schemas/job";

export function buildAdapterForSource(source: JobSource): JobSourceAdapter | null {
  const config = source.configuration as {
    boardToken?: string;
    company?: string;
  };
  switch (source.provider) {
    case "greenhouse": {
      if (!config.boardToken) return null;
      return new GreenhouseAdapter(config.boardToken);
    }
    case "lever": {
      if (!config.company) return null;
      return new LeverAdapter(config.company);
    }
    case "mock-ats":
      return new MockAtsAdapter();
    default:
      return null;
  }
}

/**
 * Build a search query from the candidate's confirmed preferences.
 * Keywords combine role titles, synonyms, technology pool and sponsorship
 * discovery terms. Keyword presence helps discovery; it is NEVER treated as
 * proof of eligibility (that is the sponsorship module's job, Phase 3).
 */
export function buildSearchQuery(
  profile: CandidateProfile,
  options: { maxKeywords?: number } = {},
): JobSearchQuery {
  const max = options.maxKeywords ?? 40;
  const keywords = new Set<string>();

  for (const family of profile.searchPreferences.roleFamilies) {
    if (!family.enabled) continue;
    keywords.add(family.title);
    for (const syn of family.synonyms) keywords.add(syn);
  }
  for (const skill of profile.searchPreferences.skillsKeywordPool) {
    keywords.add(skill);
  }
  for (const kw of profile.searchPreferences.sponsorshipKeywords.slice(0, 4)) {
    keywords.add(kw);
  }

  return {
    keywords: [...keywords].slice(0, max),
    countries: profile.relocationPreferences.targetCountries,
    cities: profile.relocationPreferences.cityPreferences,
    postedWithinDays: null,
    limit: 200,
  };
}

/** Default role families offered during onboarding (spec §1). */
export function defaultRoleFamilies(): {
  id: string;
  title: string;
  synonyms: string[];
  technologies: string[];
}[] {
  return [
    {
      id: "frontend-developer",
      title: "Frontend Developer",
      synonyms: ["Frontend Engineer", "Front-end Developer", "UI Engineer", "Web Developer"],
      technologies: ["React", "Next.js", "TypeScript", "JavaScript", "HTML", "CSS"],
    },
    {
      id: "design-engineer",
      title: "Design Engineer",
      synonyms: ["Design Technologist", "UI Engineer", "Product Engineer"],
      technologies: ["React", "CSS", "Figma", "Design systems", "Accessibility"],
    },
    {
      id: "product-designer",
      title: "Product Designer / UX Designer",
      synonyms: ["UX Designer", "UI Designer", "Product Design"],
      technologies: ["Figma", "Prototyping", "UI/UX", "Design systems"],
    },
    {
      id: "ai-nocode-developer",
      title: "AI / No-code Developer",
      synonyms: ["No-code Developer", "Low-code Developer", "AI Application Developer", "Automation Developer"],
      technologies: ["Bubble", "Webflow", "LLM integrations", "API integrations", "Supabase", "Firebase"],
    },
  ];
}

export function defaultSkillPool(): string[] {
  return [
    "React",
    "Next.js",
    "TypeScript",
    "JavaScript",
    "HTML",
    "CSS",
    "Responsive design",
    "Accessibility",
    "UI/UX",
    "Figma",
    "Prototyping",
    "Design systems",
    "Bubble",
    "Webflow",
    "Low-code development",
    "AI application development",
    "LLM integrations",
    "API integrations",
    "Supabase",
    "Firebase",
    "SQL",
  ];
}

/**
 * Boards verified live against the Greenhouse Job Board API during Phase 0
 * (2026-10-19). Health is re-checked at runtime; a 404 later is reported
 * honestly, not hidden.
 */
export function suggestedGreenhouseBoards(): {
  boardToken: string;
  displayName: string;
  note: string;
}[] {
  return [
    { boardToken: "adyen", displayName: "Adyen", note: "NL fintech · verified live" },
    { boardToken: "elastic", displayName: "Elastic", note: "NL/US · verified live" },
    { boardToken: "gitlab", displayName: "GitLab", note: "All-remote · verified live" },
  ];
}
