import type {
  AdapterHealth,
  ApplicationSubmissionInput,
  ApplicationSubmissionResult,
  JobSearchResult,
  JobSourceAdapter,
} from "./types";
import { normaliseGreenhouseJob, type RawGreenhouseJob } from "../domain/jobs/normalise";
import { jobIdFromDraft } from "../domain/jobs/dedup";
import type { JobSearchQuery } from "../domain/schemas/job";

/**
 * Mock ATS adapter — TEST ONLY.
 * Enables end-to-end coverage of the supported-submission engine without ever
 * touching a real employer system. Hard-disabled unless
 * `ALLOW_TEST_ADAPTERS=true`, which is rejected in production.
 */
export class MockAtsAdapter implements JobSourceAdapter {
  readonly id = "mock-ats__demo";
  readonly displayName = "Mock ATS (test only)";
  readonly capabilities = {
    searchJobs: true,
    fetchJobDetails: false,
    verifyEmployer: false,
    submitApplications: true,
    checkApplicationStatus: true,
  };

  /** In-memory receipts keyed by idempotency key — dedupe within a process. */
  private submissions = new Map<
    string,
    { remoteApplicationId: string; applicationId: string }
  >();

  constructor(private readonly options: { fetchImpl?: typeof fetch } = {}) {}

  private fixtures(): RawGreenhouseJob[] {
    const now = new Date().toISOString();
    return [
      {
        id: 900001,
        title: "Senior Frontend Developer",
        absolute_url: "https://example.invalid/mock/900001",
        location: { name: "Amsterdam, Netherlands" },
        first_published: now,
        updated_at: now,
        content:
          "<p>We are hiring a Senior Frontend Developer with React, TypeScript and Next.js. English working language. Relocation support and visa sponsorship available for international candidates.</p>",
        departments: [{ name: "Engineering" }],
      },
      {
        id: 900002,
        title: "Product Designer",
        absolute_url: "https://example.invalid/mock/900002",
        location: { name: "Brussels, Belgium" },
        first_published: now,
        updated_at: now,
        content:
          "<p>Product Designer with Figma, design systems and prototyping experience. Hybrid. EU work authorisation required — no sponsorship.</p>",
        departments: [{ name: "Design" }],
      },
      {
        id: 900003,
        title: "Design Engineer",
        absolute_url: "https://example.invalid/mock/900003",
        location: { name: "Remote, Netherlands" },
        first_published: now,
        updated_at: now,
        content:
          "<p>Design Engineer combining UI engineering (React, CSS, accessibility) with product design. Single permit (kennismigrant) sponsorship supported.</p>",
        departments: [{ name: "Product" }],
      },
    ];
  }

  async health(): Promise<AdapterHealth> {
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      message: "Mock ATS operational (test adapter).",
      details: { fixtureJobs: this.fixtures().length },
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<JobSearchResult> {
    const ctx = { sourceId: this.id, boardToken: "mock-employer" };
    let drafts = this.fixtures().map((f) => normaliseGreenhouseJob(f, ctx));
    if (query.keywords.length > 0) {
      const terms = query.keywords.map((k) => k.toLowerCase());
      drafts = drafts.filter((d) => {
        const haystack = `${d.title} ${d.description}`.toLowerCase();
        return terms.some((t) => haystack.includes(t));
      });
    }
    return { drafts: drafts.slice(0, query.limit), truncated: false };
  }

  async submitApplication(
    input: ApplicationSubmissionInput,
  ): Promise<ApplicationSubmissionResult> {
    const existing = this.submissions.get(input.idempotencyKey);
    if (existing) {
      return {
        status: "submitted",
        remoteApplicationId: existing.remoteApplicationId,
        confirmationUrl: `https://example.invalid/mock/applications/${existing.remoteApplicationId}`,
      };
    }
    if (!input.documents.cv.text.trim() || !input.documents.coverLetter.text.trim()) {
      return { status: "failed_permanent", error: "CV and cover letter are required." };
    }
    const remoteApplicationId = `mock-${input.idempotencyKey.slice(0, 12)}`;
    this.submissions.set(input.idempotencyKey, {
      remoteApplicationId,
      applicationId: input.applicationId,
    });
    return {
      status: "submitted",
      remoteApplicationId,
      confirmationUrl: `https://example.invalid/mock/applications/${remoteApplicationId}`,
      raw: { jobId: jobIdFromDraft(input.job), acceptedAt: new Date().toISOString() },
    };
  }
}
