import { z } from "zod";

/** Shared job-domain types used by web + functions. */

export const countryCodeSchema = z.enum(["NL", "BE", "OTHER"]);
export type CountryCode = z.infer<typeof countryCodeSchema>;

export const workplaceTypeSchema = z.enum(["remote", "hybrid", "onsite", "unspecified"]);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

export const applicationMethodSchema = z.enum([
  "supported_api_submission",
  "authorised_employer_integration",
  "external_apply",
  "manual_required",
  "unsupported",
]);
export type ApplicationMethod = z.infer<typeof applicationMethodSchema>;

export const salaryDisclosureSchema = z.enum([
  "disclosed",
  "undisclosed",
  "range_partial",
]);
export type SalaryDisclosure = z.infer<typeof salaryDisclosureSchema>;

export const jobStatusSchema = z.enum([
  "discovered",
  "analysed",
  "shortlisted",
  "archived",
  "expired",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobSchema = z.object({
  /** Deterministic id: `${provider}__${slug(sourceJobId)}` */
  id: z.string().min(1),
  sourceId: z.string().min(1),
  provider: z.string().min(1),
  sourceJobId: z.string().min(1),
  employerName: z.string().min(1),
  employerDomain: z.string().default(""),
  title: z.string().min(1),
  description: z.string().default(""),
  descriptionHtml: z.string().default(""),
  location: z.string().default(""),
  city: z.string().default(""),
  country: countryCodeSchema.default("OTHER"),
  region: z.string().default(""),
  workplaceType: workplaceTypeSchema.default("unspecified"),
  employmentType: z.string().default("unknown"),
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  salaryCurrency: z.string().max(8).nullable().default(null),
  /** Monthly EUR equivalent when normalisable; null otherwise. */
  salaryMonthlyEurMin: z.number().nullable().default(null),
  salaryMonthlyEurMax: z.number().nullable().default(null),
  salaryDisclosure: salaryDisclosureSchema.default("undisclosed"),
  salaryRaw: z.string().default(""),
  languageRequirements: z.array(z.string().max(80)).default([]),
  requiredSkills: z.array(z.string().max(120)).default([]),
  preferredSkills: z.array(z.string().max(120)).default([]),
  publishedAt: z.iso.datetime().nullable().default(null),
  discoveredAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable().default(null),
  applicationUrl: z.string().url().or(z.literal("")).default(""),
  canonicalUrl: z.string().url().or(z.literal("")).default(""),
  applicationMethod: applicationMethodSchema.default("external_apply"),
  contentHash: z.string().min(1),
  status: jobStatusSchema.default("discovered"),
  raw: z.record(z.string(), z.unknown()).nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Job = z.infer<typeof jobSchema>;

export const jobSourceCapabilitiesSchema = z.object({
  searchJobs: z.boolean(),
  fetchJobDetails: z.boolean(),
  verifyEmployer: z.boolean(),
  submitApplications: z.boolean(),
  checkApplicationStatus: z.boolean(),
});
export type JobSourceCapabilities = z.infer<typeof jobSourceCapabilitiesSchema>;

export const sourceHealthSchema = z.enum(["healthy", "degraded", "unconfigured", "failing"]);
export type SourceHealth = z.infer<typeof sourceHealthSchema>;

export const jobSourceSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  displayName: z.string().min(1),
  enabled: z.boolean().default(true),
  capabilities: jobSourceCapabilitiesSchema,
  supportedCountries: z.array(countryCodeSchema).default([]),
  lastSuccessfulSyncAt: z.iso.datetime().nullable().default(null),
  lastFailureAt: z.iso.datetime().nullable().default(null),
  lastFailureReason: z.string().default(""),
  healthStatus: sourceHealthSchema.default("unconfigured"),
  jobsLastScan: z.number().int().min(0).default(0),
  configuration: z.record(z.string(), z.unknown()).default({}),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type JobSource = z.infer<typeof jobSourceSchema>;

export const jobSearchQuerySchema = z.object({
  keywords: z.array(z.string().max(120)).default([]),
  countries: z.array(countryCodeSchema).default([]),
  cities: z.array(z.string().max(120)).default([]),
  postedWithinDays: z.number().int().min(1).max(90).nullable().default(null),
  limit: z.number().int().min(1).max(500).default(100),
});
export type JobSearchQuery = z.infer<typeof jobSearchQuerySchema>;

/** A normalised job as returned by an adapter BEFORE persistence. */
export type NormalisedJobDraft = Omit<
  Job,
  "createdAt" | "updatedAt" | "lastSeenAt" | "discoveredAt" | "id" | "status"
> & {
  /** Provider-specific id used to build the deterministic job id. */
  sourceJobId: string;
};

export function jobIdFor(provider: string, sourceJobId: string): string {
  const slug = sourceJobId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${provider}__${slug}`;
}
