import { describe, expect, it } from "vitest";
import { scoreJob } from "@domain/jobs/scoring";
import { candidateProfileSchema } from "@domain/schemas/candidate-profile";
import { jobSchema, type Job } from "@domain/schemas/job";

function makeProfile(overrides: Record<string, unknown> = {}) {
  return candidateProfileSchema.parse({
    contact: { fullName: "Test User", email: "t@example.com" },
    workAuthorisation: { requiresEmployerSponsorship: true, hasEuWorkPermit: false },
    relocationPreferences: {
      targetCountries: ["NL"],
      workplaceTypes: ["remote", "hybrid"],
      cityPreferences: ["Amsterdam"],
    },
    salaryPreferences: { minGrossMonthlyEur: 4000 },
    searchPreferences: {
      roleFamilies: [
        {
          id: "fe",
          title: "Frontend Developer",
          enabled: true,
          synonyms: ["Frontend Engineer", "UI Engineer"],
          technologies: ["React", "TypeScript"],
          minMatchScore: 70,
        },
      ],
      skillsKeywordPool: ["React", "TypeScript", "Next.js"],
      sponsorshipKeywords: ["visa sponsorship", "relocation support"],
    },
    updatedAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-19T00:00:00.000Z",
    ...overrides,
  });
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return jobSchema.parse({
    id: "greenhouse__1",
    sourceId: "s1",
    provider: "greenhouse",
    sourceJobId: "1",
    employerName: "acme",
    title: "Frontend Developer",
    description: "React and TypeScript. Visa sponsorship available.",
    location: "Amsterdam, Netherlands",
    city: "Amsterdam",
    country: "NL",
    workplaceType: "hybrid",
    employmentType: "full-time",
    salaryMonthlyEurMin: 5000,
    salaryMonthlyEurMax: 6000,
    salaryDisclosure: "disclosed",
    requiredSkills: ["React", "TypeScript"],
    preferredSkills: [],
    applicationUrl: "https://example.com/1",
    canonicalUrl: "https://example.com/1",
    contentHash: "a".repeat(32),
    discoveredAt: "2026-10-19T00:00:00.000Z",
    lastSeenAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-19T00:00:00.000Z",
    updatedAt: "2026-10-19T00:00:00.000Z",
    ...overrides,
  });
}

describe("scoreJob", () => {
  it("scores a well-matched job highly", () => {
    const score = scoreJob(makeJob(), makeProfile());
    expect(score.total).toBeGreaterThanOrEqual(70);
    expect(score.components).toHaveLength(6);
    const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
    expect(byKey.skills?.score).toBe(byKey.skills?.max);
    expect(byKey.salary?.score).toBeGreaterThanOrEqual(byKey.salary!.max - 5);
    expect(byKey.country?.score).toBe(byKey.country?.max);
    expect(byKey.workplace?.score).toBe(byKey.workplace?.max);
    expect(byKey.sponsorship?.detail).toContain("visa sponsorship");
  });

  it("penalises jobs below the salary floor", () => {
    const score = scoreJob(
      makeJob({ salaryMonthlyEurMin: 2000, salaryMonthlyEurMax: 2500 }),
      makeProfile(),
    );
    const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
    expect(byKey.salary?.score).toBeLessThan(byKey.salary!.max * 0.5);
    expect(byKey.salary?.detail).toContain("below");
  });

  it("zeroes the country component when outside targets", () => {
    const score = scoreJob(makeJob({ country: "OTHER", location: "London" }), makeProfile());
    const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
    expect(byKey.country?.score).toBe(0);
  });

  it("gives a neutral salary score when undisclosed", () => {
    const score = scoreJob(
      makeJob({
        salaryMonthlyEurMin: null,
        salaryMonthlyEurMax: null,
        salaryDisclosure: "undisclosed",
      }),
      makeProfile(),
    );
    const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
    expect(byKey.salary?.score).toBe(Math.round(25 * 0.4));
    expect(byKey.salary?.detail).toContain("not disclosed");
  });

  it("is deterministic", () => {
    const a = scoreJob(makeJob(), makeProfile());
    const b = scoreJob(makeJob(), makeProfile());
    expect(a.total).toBe(b.total);
    expect(a.components.map((c) => c.score)).toEqual(b.components.map((c) => c.score));
  });

  it("respects excluded titles", () => {
    const profile = makeProfile({
      searchPreferences: {
        roleFamilies: [
          {
            id: "fe",
            title: "Frontend Developer",
            enabled: true,
            synonyms: [],
            excludedTitles: ["Senior"],
            technologies: [],
            minMatchScore: 70,
          },
        ],
        skillsKeywordPool: ["React"],
        sponsorshipKeywords: [],
      },
    });
    const score = scoreJob(makeJob({ title: "Senior Frontend Developer" }), profile);
    const byKey = Object.fromEntries(score.components.map((c) => [c.key, c]));
    // Excluded title → best sim stays 0 for that family
    expect(byKey.roleFamily?.score).toBe(0);
  });
});
