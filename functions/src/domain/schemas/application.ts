import { z } from "zod";

/**
 * Application record — tracks a real job-application lifecycle.
 *
 * HONESTY RULES (hard constraints):
 * - `status` transitions are user-initiated or adapter-confirmed; never assumed.
 * - `external_apply` jobs record *intent* (user confirmed they applied externally),
 *   never a fabricated submission receipt.
 * - `submissionReceipt` is only set when a real API response was received
 *   (supported_api_submission or authorised_employer_integration).
 * - `outcome` is only set when the user reports it or a status-check adapter
 *   confirms it; never guessed.
 */

export const applicationStatusSchema = z.enum([
  "draft",
  "queued",
  "submitted",
  "external_confirmed",
  "in_review",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "expired",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const applicationMethodUsedSchema = z.enum([
  "external_apply",
  "supported_api_submission",
  "authorised_employer_integration",
  "manual_required",
]);
export type ApplicationMethodUsed = z.infer<typeof applicationMethodUsedSchema>;

export const submissionReceiptSchema = z.object({
  /** Provider that accepted the submission (e.g. "greenhouse-api"). */
  provider: z.string().max(80),
  /** Remote confirmation / tracking ID from the employer system. */
  remoteId: z.string().max(200).default(""),
  /** Raw response snippet (truncated) for audit. */
  raw: z.string().max(2000).default(""),
  receivedAt: z.iso.datetime(),
});
export type SubmissionReceipt = z.infer<typeof submissionReceiptSchema>;

export const applicationSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  jobId: z.string().min(1),
  jobTitle: z.string().max(200),
  employerName: z.string().max(200),
  country: z.string().max(10),
  status: applicationStatusSchema.default("draft"),
  methodUsed: applicationMethodUsedSchema.default("external_apply"),
  /** User's own notes about this application. */
  notes: z.string().max(4000).default(""),
  /** Real API receipt — only for supported_api_submission paths. */
  submissionReceipt: submissionReceiptSchema.nullable().default(null),
  /** User-confirmed external application timestamp. */
  externalConfirmedAt: z.iso.datetime().nullable().default(null),
  /** User-reported or adapter-confirmed outcome note. */
  outcome: z.string().max(500).default(""),
  /** Daily quota bucket date this submission counted against (YYYY-MM-DD). */
  quotaDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(""),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Application = z.infer<typeof applicationSchema>;

export const createApplicationInputSchema = z.object({
  jobId: z.string().min(1).max(200),
  methodUsed: applicationMethodUsedSchema.default("external_apply"),
  notes: z.string().max(4000).default(""),
  /** Set to true when the user confirms they submitted externally. */
  externalConfirmed: z.boolean().default(false),
  submissionReceipt: submissionReceiptSchema.optional(),
});
export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;

export const updateApplicationInputSchema = z.object({
  status: applicationStatusSchema.optional(),
  notes: z.string().max(4000).optional(),
  outcome: z.string().max(500).optional(),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationInputSchema>;

/** Quota state for a single UTC day. */
export const quotaStateSchema = z.object({
  /** YYYY-MM-DD UTC. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Submissions recorded today. */
  used: z.number().int().min(0),
  /** Max allowed from automationPreferences. */
  limit: z.number().int().min(0).max(50),
});
export type QuotaState = z.infer<typeof quotaStateSchema>;
