import { describe, expect, it } from "vitest";
import { classifyDuplicate, planJobUpserts, jobIdFromDraft } from "@domain/jobs/dedup";
import { canonicaliseUrl, titleSimilarity } from "@domain/jobs/hash";
import type { NormalisedJobDraft } from "@domain/schemas/job";

function draft(overrides: Partial<NormalisedJobDraft>): NormalisedJobDraft {
  return {
    sourceId: "greenhouse__acme",
    provider: "greenhouse",
    sourceJobId: "1",
    employerName: "acme",
    employerDomain: "",
    title: "Frontend Developer",
    description: "React role",
    descriptionHtml: "",
    location: "Amsterdam",
    city: "Amsterdam",
    country: "NL",
    region: "",
    workplaceType: "hybrid",
    employmentType: "full-time",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryMonthlyEurMin: null,
    salaryMonthlyEurMax: null,
    salaryDisclosure: "undisclosed",
    salaryRaw: "",
    languageRequirements: [],
    requiredSkills: [],
    preferredSkills: [],
    publishedAt: null,
    expiresAt: null,
    applicationUrl: "https://boards.greenhouse.io/acme/jobs/1",
    canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
    applicationMethod: "external_apply",
    contentHash: "a".repeat(32),
    raw: null,
    ...overrides,
  };
}

describe("canonicaliseUrl", () => {
  it("strips tracking params and www", () => {
    expect(canonicaliseUrl("https://www.example.com/jobs/1?utm_source=x&fbclid=y")).toBe(
      "https://example.com/jobs/1",
    );
  });
});

describe("titleSimilarity", () => {
  it("scores similar titles highly", () => {
    expect(titleSimilarity("Senior Frontend Developer", "Frontend Developer")).toBeGreaterThan(0.4);
    expect(titleSimilarity("Senior Frontend Developer", "Head of Kitchen")).toBeLessThan(0.1);
  });
});

describe("classifyDuplicate", () => {
  it("inserts a brand new job", () => {
    const decision = classifyDuplicate(draft({}), []);
    expect(decision).toEqual({ action: "insert", reason: "new" });
  });

  it("updates when the same provider job id exists", () => {
    const existing = [
      {
        id: "greenhouse__1",
        provider: "greenhouse",
        sourceJobId: "1",
        canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
        contentHash: "b".repeat(32),
        employerName: "acme",
        title: "Frontend Developer",
        location: "Amsterdam",
      },
    ];
    expect(classifyDuplicate(draft({}), existing)).toEqual({
      action: "update",
      existingId: "greenhouse__1",
      reason: "same_source_id",
    });
  });

  it("updates when the canonical URL matches", () => {
    const existing = [
      {
        id: "other__9",
        provider: "other",
        sourceJobId: "9",
        canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
        contentHash: "c".repeat(32),
        employerName: "acme",
        title: "Frontend Developer",
        location: "Amsterdam",
      },
    ];
    expect(classifyDuplicate(draft({}), existing)).toMatchObject({
      action: "update",
      reason: "same_canonical_url",
    });
  });

  it("skips near-duplicates at the same employer", () => {
    const existing = [
      {
        id: "greenhouse__2",
        provider: "greenhouse",
        sourceJobId: "2",
        canonicalUrl: "https://boards.greenhouse.io/acme/jobs/2",
        contentHash: "d".repeat(32),
        employerName: "acme",
        title: "Senior Frontend Developer",
        location: "Amsterdam",
      },
    ];
    const decision = classifyDuplicate(
      draft({ sourceJobId: "3", title: "Senior Frontend Developer (m/f/d)" }),
      existing,
    );
    expect(decision.action).toBe("skip");
  });

  it("keeps genuinely different roles at the same employer", () => {
    const existing = [
      {
        id: "greenhouse__4",
        provider: "greenhouse",
        sourceJobId: "4",
        canonicalUrl: "https://boards.greenhouse.io/acme/jobs/4",
        contentHash: "e".repeat(32),
        employerName: "acme",
        title: "Senior Frontend Developer",
        location: "Amsterdam",
      },
    ];
    expect(classifyDuplicate(draft({ sourceJobId: "5" }), existing).action).toBe("insert");
  });
});

describe("planJobUpserts", () => {
  it("deduplicates within the incoming batch too", () => {
    const a = draft({ sourceJobId: "10" });
    const b = draft({ sourceJobId: "10" });
    const plan = planJobUpserts([a, b], []);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert.length + plan.toUpdate.length + plan.skipped.length).toBe(2);
  });
});

describe("jobIdFromDraft", () => {
  it("builds a deterministic, firestore-safe id", () => {
    expect(jobIdFromDraft(draft({ sourceJobId: "12345" }))).toBe("greenhouse__12345");
    expect(jobIdFromDraft(draft({ sourceJobId: "abc/def GHI" }))).toBe("greenhouse__abc-def-ghi");
  });
});
