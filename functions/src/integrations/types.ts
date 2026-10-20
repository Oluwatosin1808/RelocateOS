import type {
  JobSearchQuery,
  NormalisedJobDraft,
  JobSourceCapabilities,
} from "../domain/schemas/job";

export type AdapterHealth = {
  ok: boolean;
  checkedAt: string;
  message: string;
  details?: Record<string, unknown>;
};

export type JobSearchResult = {
  drafts: NormalisedJobDraft[];
  truncated: boolean;
  providerRequestId?: string;
};

export type ApplicationSubmissionInput = {
  applicationId: string;
  job: NormalisedJobDraft;
  /** Canonical editable documents already validated. */
  documents: { cv: { text: string }; coverLetter: { text: string } };
  /** Verified answers for supported fields only. */
  formAnswers: Record<string, string>;
  idempotencyKey: string;
};

export type ApplicationSubmissionResult =
  | {
      status: "submitted";
      remoteApplicationId: string | null;
      confirmationUrl: string | null;
      raw?: unknown;
    }
  | { status: "failed_retryable"; error: string; retryAfterMs?: number }
  | { status: "failed_permanent"; error: string }
  | { status: "submission_unknown"; error: string };

/**
 * Common interface every job source must implement.
 * Capability flags MUST reflect the real integration — never desired behaviour.
 */
export interface JobSourceAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: JobSourceCapabilities;

  health(): Promise<AdapterHealth>;
  searchJobs(query: JobSearchQuery): Promise<JobSearchResult>;
  getJobDetails?(sourceJobId: string): Promise<NormalisedJobDraft | null>;
  submitApplication?(input: ApplicationSubmissionInput): Promise<ApplicationSubmissionResult>;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "rate_limit" | "not_found" | "network" | "invalid" | "server",
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export const NO_SUBMISSION_CAPABILITIES: JobSourceCapabilities = {
  searchJobs: true,
  fetchJobDetails: true,
  verifyEmployer: false,
  submitApplications: false,
  checkApplicationStatus: false,
};
