import { describe, it, expect } from "vitest";
import {
  computePipelineMetrics,
  computeStatusBreakdown,
  computeCountryBreakdown,
  computeDailyActivity,
} from "@domain/analytics/pipeline";
import type { Application } from "@domain/schemas/application";
import type { Job } from "@domain/schemas/job";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    sourceId: "src1",
    provider: "mock-ats",
    sourceJobId: "s1",
    employerName: "Acme",
    employerDomain: "acme.com",
    title: "Frontend Engineer",
    description: "Build UIs",
    descriptionHtml: "",
    location: "Amsterdam",
    city: "Amsterdam",
    country: "NL",
    region: "",
    workplaceType: "hybrid",
    employmentType: "full_time",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "EUR",
    salaryMonthlyEurMin: null,
    salaryMonthlyEurMax: null,
    salaryDisclosure: "undisclosed",
    salaryRaw: "",
    languageRequirements: [],
    requiredSkills: ["react"],
    preferredSkills: [],
    publishedAt: null,
    discoveredAt: "2026-10-19T10:00:00.000Z",
    lastSeenAt: "2026-10-19T10:00:00.000Z",
    expiresAt: null,
    applicationUrl: "https://example.com/j1/apply",
    canonicalUrl: "https://example.com/j1",
    applicationMethod: "external_apply",
    contentHash: "hash",
    status: "discovered",
    raw: null,
    createdAt: "2026-10-19T10:00:00.000Z",
    updatedAt: "2026-10-19T10:00:00.000Z",
    ...overrides,
  };
}

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: "a1",
    uid: "u1",
    jobId: "j1",
    jobTitle: "Frontend Engineer",
    employerName: "Acme",
    country: "NL",
    status: "submitted",
    methodUsed: "external_apply",
    notes: "",
    submissionReceipt: null,
    externalConfirmedAt: null,
    outcome: "",
    quotaDay: "2026-10-19",
    createdAt: "2026-10-19T10:00:00.000Z",
    updatedAt: "2026-10-19T10:00:00.000Z",
    ...overrides,
  };
}

describe("computePipelineMetrics", () => {
  it("computes discovered count excluding archived", () => {
    const jobs = [makeJob(), makeJob({ id: "j2", status: "archived" })];
    expect(computePipelineMetrics(jobs, []).discovered).toBe(1);
  });
  it("computes shortlisted count", () => {
    const jobs = [makeJob({ status: "shortlisted" })];
    expect(computePipelineMetrics(jobs, []).shortlisted).toBe(1);
  });
  it("computes applied count from active applications", () => {
    const apps = [makeApp({ status: "submitted" })];
    expect(computePipelineMetrics([], apps).applied).toBe(1);
  });
  it("excludes withdrawn from applied", () => {
    const apps = [makeApp({ status: "withdrawn" })];
    expect(computePipelineMetrics([], apps).applied).toBe(0);
  });
  it("computes interviewing", () => {
    const apps = [makeApp({ status: "interview" }), makeApp({ id: "a2", status: "offer" })];
    expect(computePipelineMetrics([], apps).interviewing).toBe(2);
  });
  it("applyRate null when shortlisted is 0", () => {
    expect(computePipelineMetrics([], []).applyRate).toBeNull();
  });
  it("applyRate is a percentage", () => {
    const jobs = [makeJob({ status: "shortlisted" })];
    const apps = [makeApp({ status: "submitted" })];
    expect(computePipelineMetrics(jobs, apps).applyRate).toBe(100);
  });
  it("interviewRate null when applied is 0", () => {
    expect(computePipelineMetrics([], []).interviewRate).toBeNull();
  });
});

describe("computeStatusBreakdown", () => {
  it("groups by status", () => {
    const apps = [makeApp({ status: "submitted" }), makeApp({ id: "a2", status: "interview" })];
    const result = computeStatusBreakdown(apps);
    expect(result).toHaveLength(2);
  });
  it("sorts by count desc", () => {
    const apps = [
      makeApp({ status: "submitted" }),
      makeApp({ id: "a2", status: "submitted" }),
      makeApp({ id: "a3", status: "interview" }),
    ];
    const result = computeStatusBreakdown(apps);
    expect(result[0]?.status).toBe("submitted");
    expect(result[0]?.count).toBe(2);
  });
  it("returns empty for no apps", () => {
    expect(computeStatusBreakdown([])).toEqual([]);
  });
});

describe("computeCountryBreakdown", () => {
  it("groups by country", () => {
    const apps = [makeApp({ country: "NL" }), makeApp({ id: "a2", country: "BE" })];
    expect(computeCountryBreakdown(apps)).toHaveLength(2);
  });
  it("defaults empty country to OTHER", () => {
    const apps = [makeApp({ country: "" })];
    expect(computeCountryBreakdown(apps)[0]?.status).toBe("OTHER");
  });
});

describe("computeDailyActivity", () => {
  it("returns one entry per day", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    const result = computeDailyActivity([], 7, now);
    expect(result).toHaveLength(7);
  });
  it("counts apps on the right day", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    const apps = [makeApp({ createdAt: "2026-10-18T10:00:00.000Z" })];
    const result = computeDailyActivity(apps, 7, now);
    const day18 = result.find((d) => d.day === "2026-10-18");
    expect(day18?.count).toBe(1);
  });
  it("ignores apps older than the window", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    const apps = [makeApp({ createdAt: "2026-01-01T10:00:00.000Z" })];
    const result = computeDailyActivity(apps, 7, now);
    expect(result.every((d) => d.count === 0)).toBe(true);
  });
  it("is sorted ascending by day", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    const result = computeDailyActivity([], 5, now);
    const days = result.map((d) => d.day);
    expect([...days].sort()).toEqual(days);
  });
});
