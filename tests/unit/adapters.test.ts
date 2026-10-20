import { describe, expect, it, vi } from "vitest";
import { GreenhouseAdapter } from "@fn/integrations/greenhouse";
import { LeverAdapter } from "@fn/integrations/lever";
import { MockAtsAdapter } from "@fn/integrations/mock-ats";
import { buildSearchQuery, buildAdapterForSource } from "@fn/integrations/registry";
import { candidateProfileSchema } from "@domain/schemas/candidate-profile";
import type { JobSource } from "@domain/schemas/job";

const greenhousesJobs = {
  jobs: [
    {
      id: 1,
      title: "Frontend Developer",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
      location: { name: "Amsterdam, Netherlands" },
      first_published: "2026-10-01T00:00:00Z",
      content: "<p>React, TypeScript. €4,000 per month. Visa sponsorship available.</p>",
    },
    {
      id: 2,
      title: "Backend Engineer",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/2",
      location: { name: "Berlin, Germany" },
      content: "<p>Go, Kubernetes.</p>",
    },
  ],
};

function fetchReturning(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("GreenhouseAdapter", () => {
  it("normalises real API payloads and applies keyword filters", async () => {
    const adapter = new GreenhouseAdapter("acme", { fetchImpl: fetchReturning(200, greenhousesJobs) });
    const result = await adapter.searchJobs({
      keywords: ["frontend"],
      countries: [],
      cities: [],
      postedWithinDays: null,
      limit: 50,
    });
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.title).toBe("Frontend Developer");
    expect(result.drafts[0]?.country).toBe("NL");
    expect(result.drafts[0]?.applicationMethod).toBe("external_apply");
  });

  it("reports health honestly for a missing board", async () => {
    const adapter = new GreenhouseAdapter("nope", {
      fetchImpl: fetchReturning(404, { error: "not found" }),
    });
    const health = await adapter.health();
    expect(health.ok).toBe(false);
    expect(health.message).toMatch(/404/);
  });

  it("throws a not_found AdapterError on 404 search", async () => {
    const adapter = new GreenhouseAdapter("nope", {
      fetchImpl: fetchReturning(404, {}),
    });
    await expect(
      adapter.searchJobs({ keywords: [], countries: [], cities: [], postedWithinDays: null, limit: 10 }),
    ).rejects.toThrow(/not found/i);
  });

  it("never claims submission capability", () => {
    const adapter = new GreenhouseAdapter("acme", { fetchImpl: fetchReturning(200, greenhousesJobs) });
    expect(adapter.capabilities.submitApplications).toBe(false);
    expect(adapter.capabilities.searchJobs).toBe(true);
  });
});

describe("LeverAdapter", () => {
  it("reports 404 as unhealthy without inventing data", async () => {
    const adapter = new LeverAdapter("somecompany", {
      fetchImpl: fetchReturning(404, {}),
    });
    const health = await adapter.health();
    expect(health.ok).toBe(false);
    expect(health.message).toMatch(/404/);
  });
});

describe("MockAtsAdapter", () => {
  it("returns fixture jobs and supports idempotent submission", async () => {
    const adapter = new MockAtsAdapter();
    const search = await adapter.searchJobs({
      keywords: [],
      countries: [],
      cities: [],
      postedWithinDays: null,
      limit: 10,
    });
    expect(search.drafts.length).toBe(3);

    const job = search.drafts[0]!;
    const input = {
      applicationId: "app-1",
      job,
      documents: { cv: { text: "CV text" }, coverLetter: { text: "Letter text" } },
      formAnswers: {},
      idempotencyKey: "idem-1",
    };
    const first = await adapter.submitApplication!(input);
    const second = await adapter.submitApplication!(input);
    expect(first.status).toBe("submitted");
    expect(second.status).toBe("submitted");
    expect(second.status === "submitted" && second.remoteApplicationId).toBe(
      first.status === "submitted" && first.remoteApplicationId,
    );
  });

  it("rejects submission without documents", async () => {
    const adapter = new MockAtsAdapter();
    const search = await adapter.searchJobs({
      keywords: [],
      countries: [],
      cities: [],
      postedWithinDays: null,
      limit: 1,
    });
    const result = await adapter.submitApplication!({
      applicationId: "app-2",
      job: search.drafts[0]!,
      documents: { cv: { text: "" }, coverLetter: { text: "" } },
      formAnswers: {},
      idempotencyKey: "idem-2",
    });
    expect(result.status).toBe("failed_permanent");
  });
});

describe("registry", () => {
  it("builds adapters from source config and refuses incomplete config", () => {
    const base = {
      id: "s1",
      displayName: "s1",
      enabled: true,
      capabilities: {
        searchJobs: true,
        fetchJobDetails: true,
        verifyEmployer: false,
        submitApplications: false,
        checkApplicationStatus: false,
      },
      supportedCountries: [],
      lastSuccessfulSyncAt: null,
      lastFailureAt: null,
      lastFailureReason: "",
      healthStatus: "unconfigured" as const,
      jobsLastScan: 0,
      updatedAt: "2026-10-19T00:00:00.000Z",
      createdAt: "2026-10-19T00:00:00.000Z",
    };
    const gh = buildAdapterForSource({
      ...base,
      provider: "greenhouse",
      configuration: { boardToken: "acme" },
    } as JobSource);
    expect(gh?.id).toBe("greenhouse__acme");

    const missing = buildAdapterForSource({
      ...base,
      provider: "greenhouse",
      configuration: {},
    } as JobSource);
    expect(missing).toBeNull();
  });

  it("builds a search query from profile preferences", () => {
    const profile = candidateProfileSchema.parse({
      searchPreferences: {
        roleFamilies: [
          {
            id: "fe",
            title: "Frontend Developer",
            synonyms: ["UI Engineer"],
            technologies: ["React"],
            enabled: true,
          },
        ],
        skillsKeywordPool: ["TypeScript"],
      },
      relocationPreferences: { targetCountries: ["NL", "BE"] },
      updatedAt: "2026-10-19T00:00:00.000Z",
      createdAt: "2026-10-19T00:00:00.000Z",
    });
    const q = buildSearchQuery(profile);
    expect(q.keywords).toContain("Frontend Developer");
    expect(q.keywords).toContain("UI Engineer");
    expect(q.keywords).toContain("TypeScript");
    expect(q.countries).toEqual(["NL", "BE"]);
  });
});
