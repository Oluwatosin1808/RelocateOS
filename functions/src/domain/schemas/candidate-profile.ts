import { z } from "zod";

/**
 * Candidate profile — the single source of truth for application documents.
 * NOTHING here is ever fabricated by the system: every fact originates from
 * explicit user input or from a reviewed CV import. Unknown facts stay empty.
 */

export const provenanceSchema = z.enum([
  "user-asserted",
  "imported-pending-review",
  "verified-source",
]);
export type Provenance = z.infer<typeof provenanceSchema>;

/** A profile fact with provenance so generated documents stay traceable. */
export function fact<T extends z.ZodType>(inner: T) {
  return z.object({
    value: inner,
    provenance: provenanceSchema.default("user-asserted"),
    note: z.string().optional(),
  });
}

export const contactInfoSchema = z.object({
  fullName: z.string().max(120).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(50).default(""),
  currentCity: z.string().max(120).default(""),
  currentCountry: z.string().max(120).default("Nigeria"),
  nationality: z.string().max(120).default(""),
  linkedinUrl: z.string().url().or(z.literal("")).default(""),
  githubUrl: z.string().url().or(z.literal("")).default(""),
  portfolioUrls: z.array(z.string().url()).max(20).default([]),
});
export type ContactInfo = z.infer<typeof contactInfoSchema>;

export const workExperienceSchema = z.object({
  id: z.string().min(1),
  jobTitle: z.string().min(1).max(160),
  employer: z.string().min(1).max(160),
  location: z.string().max(160).default(""),
  employmentType: z
    .enum(["full-time", "part-time", "contract", "internship", "freelance", "unknown"])
    .default("unknown"),
  startDate: z.string().regex(/^\d{4}(-\d{2})?$/),
  endDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")),
  isCurrent: z.boolean().default(false),
  description: z.string().max(4000).default(""),
  technologies: z.array(z.string().max(80)).max(40).default([]),
  provenance: provenanceSchema.default("user-asserted"),
});
export type WorkExperience = z.infer<typeof workExperienceSchema>;

export const educationSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1).max(200),
  qualification: z.string().min(1).max(200),
  fieldOfStudy: z.string().max(200).default(""),
  startDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")).default(""),
  endDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")).default(""),
  grade: z.string().max(80).optional(),
  description: z.string().max(2000).default(""),
  provenance: provenanceSchema.default("user-asserted"),
});
export type Education = z.infer<typeof educationSchema>;

export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  category: z
    .enum(["language", "framework", "tool", "platform", "design", "ai", "soft", "other"])
    .default("other"),
  yearsExperience: z.number().min(0).max(60).nullable().default(null),
  provenance: provenanceSchema.default("user-asserted"),
});
export type Skill = z.infer<typeof skillSchema>;

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  url: z.string().url().or(z.literal("")).default(""),
  description: z.string().max(3000).default(""),
  technologies: z.array(z.string().max(80)).max(40).default([]),
  role: z.string().max(160).default(""),
  startDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")).default(""),
  endDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")).default(""),
  provenance: provenanceSchema.default("user-asserted"),
});
export type Project = z.infer<typeof projectSchema>;

export const certificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).default(""),
  issuedDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")).default(""),
  expiresDate: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal("")).default(""),
  credentialUrl: z.string().url().or(z.literal("")).default(""),
  provenance: provenanceSchema.default("user-asserted"),
});
export type Certification = z.infer<typeof certificationSchema>;

export const languageSkillSchema = z.object({
  id: z.string().min(1),
  language: z.string().min(1).max(80),
  proficiency: z.enum([
    "basic",
    "conversational",
    "professional",
    "fluent",
    "native",
  ]),
  provenance: provenanceSchema.default("user-asserted"),
});
export type LanguageSkill = z.infer<typeof languageSkillSchema>;

export const workAuthorisationSchema = z.object({
  hasEuWorkPermit: z.boolean().default(false),
  euPermitDetails: z.string().max(1000).default(""),
  requiresEmployerSponsorship: z.boolean().default(true),
  noticePeriodWeeks: z.number().int().min(0).max(104).nullable().default(null),
  immigrationHistory: z.string().max(2000).default(""),
  notes: z.string().max(2000).default(""),
});
export type WorkAuthorisation = z.infer<typeof workAuthorisationSchema>;

export const relocationPreferencesSchema = z.object({
  currentCountry: z.string().min(1).max(120).default("Nigeria"),
  targetCountries: z
    .array(z.enum(["NL", "BE"]))
    .min(1)
    .default(["NL", "BE"]),
  relocationWindowMonths: z
    .object({ min: z.number().int().min(0).max(60), max: z.number().int().min(1).max(60) })
    .default({ min: 6, max: 12 }),
  preferredWorkingLanguage: z.string().min(1).max(80).default("English"),
  preferredAccommodation: z
    .enum(["private-apartment", "shared-apartment", "studio", "flexible"])
    .default("private-apartment"),
  employmentObjective: z
    .string()
    .min(1)
    .max(500)
    .default(
      "Obtain a legitimate job offer and the appropriate authorisation to live and work in the destination country.",
    ),
  cityPreferences: z.array(z.string().max(120)).max(30).default([]),
  workplaceTypes: z
    .array(z.enum(["remote", "hybrid", "onsite"]))
    .default(["remote", "hybrid"]),
});
export type RelocationPreferences = z.infer<typeof relocationPreferencesSchema>;

export const salaryPreferencesSchema = z.object({
  minGrossMonthlyEur: z.number().int().min(0).max(50000).default(3000),
  currency: z.enum(["EUR"]).default("EUR"),
  notes: z.string().max(500).default(""),
});
export type SalaryPreferences = z.infer<typeof salaryPreferencesSchema>;

export const roleFamilySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  synonyms: z.array(z.string().max(120)).max(40).default([]),
  excludedTitles: z.array(z.string().max(120)).max(40).default([]),
  seniorityPreferences: z
    .array(z.enum(["intern", "junior", "mid", "senior", "lead", "any"]))
    .default(["mid", "senior", "any"]),
  technologies: z.array(z.string().max(80)).max(60).default([]),
  industries: z.array(z.string().max(80)).max(30).default([]),
  minMatchScore: z.number().int().min(0).max(100).default(70),
  locations: z.array(z.string().max(120)).max(30).default([]),
});
export type RoleFamily = z.infer<typeof roleFamilySchema>;

export const searchPreferencesSchema = z.object({
  roleFamilies: z.array(roleFamilySchema).max(10).default([]),
  skillsKeywordPool: z.array(z.string().max(80)).max(80).default([]),
  sponsorshipKeywords: z
    .array(z.string().max(120))
    .default([
      "visa sponsorship",
      "relocation support",
      "highly skilled migrant",
      "single permit",
      "kennismigrant",
      "permit support",
    ]),
  excludeAgencies: z.boolean().default(false),
});
export type SearchPreferences = z.infer<typeof searchPreferencesSchema>;

export const automationPreferencesSchema = z.object({
  maxAutoSubmissionsPerDay: z.number().int().min(0).max(50).default(10),
  applicationMode: z
    .enum(["discover-evaluate-queue", "supported-auto-apply"])
    .default("discover-evaluate-queue"),
  autoApplyEnabled: z.boolean().default(false),
});
export type AutomationPreferences = z.infer<typeof automationPreferencesSchema>;

export const cvFileSchema = z.object({
  id: z.string().min(1),
  storagePath: z.string().min(1),
  originalName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  uploadedAt: z.iso.datetime(),
  extractedTextChars: z.number().int().min(0).default(0),
});
export type CvFile = z.infer<typeof cvFileSchema>;

export const documentPreferencesSchema = z.object({
  cvTone: z.enum(["professional", "concise", "detailed"]).default("professional"),
  coverLetterLength: z.enum(["short", "medium"]).default("medium"),
  includePhoto: z.boolean().default(false),
});
export type DocumentPreferences = z.infer<typeof documentPreferencesSchema>;

export const candidateProfileSchema = z.object({
  contact: contactInfoSchema.prefault({}),
  professionalSummary: z.string().max(2000).default(""),
  workExperience: z.array(workExperienceSchema).max(50).default([]),
  education: z.array(educationSchema).max(30).default([]),
  skills: z.array(skillSchema).max(120).default([]),
  projects: z.array(projectSchema).max(50).default([]),
  certifications: z.array(certificationSchema).max(50).default([]),
  languages: z.array(languageSkillSchema).max(20).default([]),
  workAuthorisation: workAuthorisationSchema.prefault({}),
  relocationPreferences: relocationPreferencesSchema.prefault({}),
  salaryPreferences: salaryPreferencesSchema.prefault({}),
  searchPreferences: searchPreferencesSchema.prefault({}),
  automationPreferences: automationPreferencesSchema.prefault({}),
  cvFiles: z.array(cvFileSchema).max(20).default([]),
  documentPreferences: documentPreferencesSchema.prefault({}),
  lastVerifiedAt: z.iso.datetime().nullable().default(null),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

/** Profile completeness — used for gating application drafts (never a fabrication). */
export function computeProfileCompleteness(profile: CandidateProfile): {
  score: number;
  missing: string[];
} {
  const missing: string[] = [];
  let hit = 0;
  const total = 8;

  if (profile.contact.fullName && profile.contact.email) hit += 1;
  else missing.push("Contact name and email");

  if (profile.professionalSummary.trim().length >= 80) hit += 1;
  else missing.push("Professional summary (80+ characters)");

  if (profile.workExperience.length > 0) hit += 1;
  else missing.push("At least one work experience entry");

  if (profile.education.length > 0) hit += 1;
  else missing.push("Education entry");

  if (profile.skills.length >= 5) hit += 1;
  else missing.push("At least five skills");

  if (profile.languages.length > 0) hit += 1;
  else missing.push("Languages");

  if (profile.contact.portfolioUrls.length > 0 || profile.projects.length > 0) hit += 1;
  else missing.push("Portfolio URL or project");

  if (profile.cvFiles.length > 0) hit += 1;
  else missing.push("At least one CV file");

  return { score: Math.round((hit / total) * 100), missing };
}
