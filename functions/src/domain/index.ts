export { userDocSchema, type UserDoc } from "./schemas/user";
export {
  candidateProfileSchema,
  computeProfileCompleteness,
  type CandidateProfile,
  type RoleFamily,
  type RelocationPreferences,
  type WorkExperience,
  type Skill,
  type Education,
  type Project,
  type LanguageSkill,
} from "./schemas/candidate-profile";
export {
  jobSchema,
  jobSourceSchema,
  jobSearchQuerySchema,
  jobIdFor,
  type Job,
  type JobSource,
  type JobSearchQuery,
  type NormalisedJobDraft,
  type ApplicationMethod,
  type CountryCode,
} from "./schemas/job";
export { parseSalary, type ParsedSalary } from "./jobs/salary";
export {
  jobContentHash,
  canonicaliseUrl,
  titleSimilarity,
} from "./jobs/hash";
export {
  normaliseGreenhouseJob,
  normaliseLeverJob,
  inferCountry,
  inferWorkplaceType,
  extractSkills,
  extractLanguageRequirements,
  extractSalaryText,
  parseLooseDate,
  type RawGreenhouseJob,
  type RawLeverPosting,
} from "./jobs/normalise";
export {
  classifyDuplicate,
  planJobUpserts,
  jobIdFromDraft,
  type ExistingJobKey,
  type DedupDecision,
} from "./jobs/dedup";
