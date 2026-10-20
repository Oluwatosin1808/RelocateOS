import {
  AdapterError,
  NO_SUBMISSION_CAPABILITIES,
  type AdapterHealth,
  type JobSearchResult,
  type JobSourceAdapter,
} from "./types";
import { normaliseLeverJob, type RawLeverPosting } from "../domain/jobs/normalise";
import type { JobSearchQuery } from "../domain/schemas/job";

/**
 * Lever Postings API adapter (public discovery only).
 * Docs: https://github.com/lever/postings-api
 *
 * A public posting list does NOT grant a general-purpose submission
 * endpoint. Submission stays external_apply unless an employer-authorised
 * integration exists (none does today).
 *
 * NOTE (Phase 0 verification, 2026-10-19): the public API returned 404 for
 * every sampled company. The adapter is still implemented against the
 * documented contract; health() reports the truth and discovery fails
 * loudly rather than inventing jobs.
 */
export class LeverAdapter implements JobSourceAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities = { ...NO_SUBMISSION_CAPABILITIES, fetchJobDetails: false };

  constructor(
    private readonly company: string,
    private readonly options: { baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
  ) {
    this.id = `lever__${company}`;
    this.displayName = `Lever · ${company}`;
  }

  private url(): string {
    const base = this.options.baseUrl ?? "https://api.lever.co";
    return `${base}/v0/postings/${encodeURIComponent(this.company)}?mode=json`;
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

  async health(): Promise<AdapterHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await this.request();
      if (res.status === 404) {
        return {
          ok: false,
          checkedAt,
          message: `Lever postings API returned 404 for "${this.company}". The public API may be unavailable or the handle is wrong — no jobs will be invented.`,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          checkedAt,
          message: `Lever responded ${res.status} for "${this.company}".`,
        };
      }
      const body = (await res.json()) as RawLeverPosting[];
      return {
        ok: true,
        checkedAt,
        message: `Handle reachable — ${body.length} postings visible.`,
        details: { jobCount: body.length },
      };
    } catch (err) {
      return {
        ok: false,
        checkedAt,
        message: err instanceof Error ? err.message : "Network error contacting Lever.",
      };
    }
  }

  async searchJobs(query: JobSearchQuery): Promise<JobSearchResult> {
    const res = await this.request();
    if (res.status === 404) {
      throw new AdapterError(
        `Lever postings API returned 404 for "${this.company}"`,
        "not_found",
      );
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5") * 1000;
      throw new AdapterError("Lever rate limit hit", "rate_limit", retryAfter);
    }
    if (!res.ok) {
      throw new AdapterError(`Lever error ${res.status}`, "server");
    }
    const raw = (await res.json()) as RawLeverPosting[];
    const ctx = { sourceId: this.id, company: this.company };
    let drafts = raw.map((posting) => normaliseLeverJob(posting, ctx));

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
        if (!d.publishedAt) return true;
        return new Date(d.publishedAt).getTime() >= cutoff;
      });
    }

    const truncated = drafts.length > query.limit;
    return { drafts: drafts.slice(0, query.limit), truncated };
  }
}
