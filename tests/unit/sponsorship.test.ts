import { describe, expect, it } from "vitest";
import {
  assessSponsorship,
  assessSponsorshipForTargets,
  sponsorshipAssessmentInputSchema,
} from "@domain/immigration/sponsorship";

const baseInput = sponsorshipAssessmentInputSchema.parse({
  nationality: "Nigerian",
  hasEuWorkPermit: false,
  requiresEmployerSponsorship: true,
  targetCountry: "NL",
  grossMonthlyEur: 5000,
  jobTitle: "Frontend Developer",
});

describe("assessSponsorship", () => {
  it("flags sponsorship-required candidates", () => {
    const result = assessSponsorship(baseInput);
    expect(result.authorisationStatus).toBe("sponsorship-required");
    expect(result.preliminaryIndicator).toBe("needs_sponsorship");
    expect(result.pathways.length).toBeGreaterThan(0);
    expect(result.disclaimer).toContain("NOT legal advice");
  });

  it("flags EU permit holders as likely eligible", () => {
    const result = assessSponsorship({
      ...baseInput,
      hasEuWorkPermit: true,
      requiresEmployerSponsorship: false,
    });
    expect(result.authorisationStatus).toBe("eu-permit-holder");
    expect(result.preliminaryIndicator).toBe("eligible_to_work");
    expect(result.pathways[0]?.id).toBe("existing-permit");
  });

  it("returns unknown when status is unclear", () => {
    const result = assessSponsorship({
      ...baseInput,
      requiresEmployerSponsorship: false,
      hasEuWorkPermit: false,
    });
    expect(result.authorisationStatus).toBe("unknown");
    expect(result.preliminaryIndicator).toBe("unknown");
    expect(result.pathways.some((p) => p.id === "clarify-status")).toBe(true);
  });

  it("checks NL salary threshold when disclosed", () => {
    const result = assessSponsorship({ ...baseInput, grossMonthlyEur: 6200 });
    expect(result.salaryThresholdCheck?.applicable).toBe(true);
    expect(result.salaryThresholdCheck?.meetsThreshold).toBe(true);
    expect(result.salaryThresholdCheck?.thresholdEur).toBe(5942);
    expect(result.salaryThresholdCheck?.note).toContain("ind.nl");
  });

  it("flags below-threshold salary honestly", () => {
    const result = assessSponsorship({ ...baseInput, grossMonthlyEur: 2500 });
    expect(result.salaryThresholdCheck?.meetsThreshold).toBe(false);
  });

  it("uses the under-30 threshold for junior-titled roles", () => {
    const result = assessSponsorship({
      ...baseInput,
      jobTitle: "Junior Frontend Developer",
      grossMonthlyEur: 4500,
    });
    expect(result.salaryThresholdCheck?.thresholdEur).toBe(4357);
    expect(result.salaryThresholdCheck?.meetsThreshold).toBe(true);
  });

  it("does not invent a threshold when salary is undisclosed", () => {
    const result = assessSponsorship({ ...baseInput, grossMonthlyEur: null });
    expect(result.salaryThresholdCheck?.offeredEur).toBeNull();
    expect(result.salaryThresholdCheck?.meetsThreshold).toBeNull();
  });

  it("builds BE pathways for Belgium", () => {
    const result = assessSponsorship({ ...baseInput, targetCountry: "BE" });
    expect(result.targetCountry).toBe("BE");
    expect(result.pathways.map((p) => p.id)).toContain("blue-card");
    expect(result.pathways.map((p) => p.id)).toContain("single-permit-be");
  });

  it("is deterministic", () => {
    const a = assessSponsorship(baseInput);
    const b = assessSponsorship(baseInput);
    expect(a.pathways.map((p) => p.id)).toEqual(b.pathways.map((p) => p.id));
    expect(a.preliminaryIndicator).toBe(b.preliminaryIndicator);
  });
});

describe("assessSponsorshipForTargets", () => {
  it("assesses both NL and BE", () => {
    const results = assessSponsorshipForTargets(
      {
        nationality: "Nigerian",
        hasEuWorkPermit: false,
        freeTextPermitDetails: "",
        requiresEmployerSponsorship: true,
        grossMonthlyEur: 5000,
        jobTitle: "Frontend Developer",
      },
      ["NL", "BE"],
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.targetCountry).toBe("NL");
    expect(results[1]?.targetCountry).toBe("BE");
  });
});
