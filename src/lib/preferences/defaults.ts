/** Client-safe constants for onboarding + profile forms (no server imports). */

export const COUNTRY_OPTIONS = [
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
] as const;

export const WORKPLACE_OPTIONS = [
  { code: "remote", label: "Remote" },
  { code: "hybrid", label: "Hybrid" },
  { code: "onsite", label: "On-site" },
] as const;

export const DEFAULT_ROLE_FAMILIES = [
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
    synonyms: [
      "No-code Developer",
      "Low-code Developer",
      "AI Application Developer",
      "Automation Developer",
    ],
    technologies: [
      "Bubble",
      "Webflow",
      "LLM integrations",
      "API integrations",
      "Supabase",
      "Firebase",
    ],
  },
] as const;

export const DEFAULT_SKILL_POOL = [
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
] as const;

export const SUGGESTED_GREENHOUSE_BOARDS = [
  { boardToken: "adyen", displayName: "Adyen", note: "NL fintech · verified live" },
  { boardToken: "elastic", displayName: "Elastic", note: "NL/US · verified live" },
  { boardToken: "gitlab", displayName: "GitLab", note: "All-remote · verified live" },
] as const;
