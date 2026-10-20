import {
  AdapterError,
  NO_SUBMISSION_CAPABILITIES,
  type AdapterHealth,
  type JobSearchResult,
  type JobSourceAdapter,
} from "./types";
import {
  normaliseGreenhouseJob,
  type RawGreenhouseJob,
} from "../domain/jobs/normalise";
import type { JobSearchQuery } from "../domain/schemas/job";

/**
 * Greenhouse Job Board API adapter (public discovery only).
 * Docs: https://docs.greenhouse.io/job-board
 *
 * The public job-board API does NOT grant access to Greenhouse's
 * employer-facing application endpoints. Without an employer-generated
 * API key the candidate does not possess, submission stays external_apply.
 */
export class GreenhouseAdapter implements JobSourceAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities = { ...NO_SUBMISSION_CAPABILITIES, fetchJobDetails: false };

  constructor(
    private readonly boardToken: string,
    private readonly options: { baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
  ) {
    this.id = `greenhouse__${boardToken}`;
    this.displayName = `Greenhouse · ${boardToken}`;
  }

  private url(): string {
    const base = this.options.baseUrl ?? "https://boards-api.greenhouse.io";
    return `${base}/v1/boards/${encodeURIComponent(this.boardToken)}/jobs?content=true`;
  }

  async health(): Promise<AdapterHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await this.request();
      if (res.status === 404) {
        return {
          ok: false,
          checkedAt,
          message: `Board token "${this.boardToken}" not found on Greenhouse (404). Check the token or disable this source.`,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          checkedAt,
          message: `Greenhouse responded ${res.status} for board "${this.boardToken}".`,
        };
      }
      const body = (await res.json()) as { jobs?: RawGreenhouseJob[] };
      return {
        ok: true,
        checkedAt,
        message: `Board reachable — ${body.jobs?.length ?? 0} open jobs visible.`,
        details: { jobCount: body.jobs?.length ?? 0 },
      };
    } catch (err) {
      return {
        ok: false,
        checkedAt,
        message: err instanceof Error ? err.message : "Network error contacting Greenhouse.",
      };
    }
  }

  private async request(): Promise<Response> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20000);
    try {
      return await fetchImpl(this.url(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      throw new AdapterError(
        err instanceof Error ? err.message : "Network error",
        "network",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async searchJobs(query: JobSearchQuery): Promise<JobSearchResult> {
    const res = await this.request();
    if (res.status === 404) {
      throw new AdapterError(`Greenhouse board "${this.boardToken}" not found`, "not_found");
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5") * 1000;
      throw new AdapterError("Greenhouse rate limit hit", "rate_limit", retryAfter);
    }
    if (!res.ok) {
      throw new AdapterError(`Greenhouse error ${res.status}`, "server");
    }
    const body = (await res.json()) as { jobs?: RawGreenhouseJob[] };
    const rawJobs = body.jobs ?? [];
    const ctx = { sourceId: this.id, boardToken: this.boardToken };
    let drafts = rawJobs.map((job) => normaliseGreenhouseJob(job, ctx));

    // Server-side keyword pre-filter (Greenhouse returns ALL board jobs).
    if (query.keywords.length > 0) {
      const terms = query.keywords.map((k) => k.toLowerCase());
      drafts = drafts.filter((d) => {
        const haystack = `${d.title} ${d.description}`.toLowerCase();
        return terms.some((t) => haystack.includes(t));
      });
    }
    if (query.cities.length > 0) {
      const cities = query.cities.map((c) => c.toLowerCase());
      drafts = drafts.filter((d) =>
        cities.some(
          (c) => d.location.toLowerCase().includes(c) || d.city.toLowerCase().includes(c),
        ),
      );
    }
    if (query.postedWithinDays != null) {
      const cutoff = Date.now() - query.postedWithinDays * 24 * 60 * 60 * 1000;
      drafts = drafts.filter((d) => {
        if (!d.publishedAt) return true; // keep undated; freshness unknown ≠ expired
        return new Date(d.publishedAt).getTime() >= cutoff;
      });
    }

    const truncated = drafts.length > query.limit;
    return { drafts: drafts.slice(0, query.limit), truncated };
  }
}
