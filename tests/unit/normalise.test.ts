import { describe, expect, it } from "vitest";
import {
  normaliseGreenhouseJob,
  normaliseLeverJob,
  inferCountry,
  inferWorkplaceType,
  extractSkills,
  type RawGreenhouseJob,
  type RawLeverPosting,
} from "@domain/jobs/normalise";

describe("inferCountry", () => {
  it("detects Netherlands locations", () => {
    expect(inferCountry("Amsterdam, Netherlands")).toBe("NL");
    expect(inferCountry("Utrecht")).toBe("NL");
    expect(inferCountry("Remote - Europe (NL)")).toBe("NL");
  });
  it("detects Belgium locations", () => {
    expect(inferCountry("Brussels, Belgium")).toBe("BE");
    expect(inferCountry("Gent")).toBe("BE");
    expect(inferCountry("Antwerp")).toBe("BE");
  });
  it("returns OTHER for elsewhere", () => {
    expect(inferCountry("London, United Kingdom")).toBe("OTHER");
    expect(inferCountry("")).toBe("OTHER");
  });
});

describe("inferWorkplaceType", () => {
  it("prefers hybrid when both hybrid and remote appear", () => {
    expect(inferWorkplaceType("Hybrid remote-friendly role")).toBe("hybrid");
  });
  it("detects remote and onsite", () => {
    expect(inferWorkplaceType("Fully remote within NL")).toBe("remote");
    expect(inferWorkplaceType("On-site in our office")).toBe("onsite");
    expect(inferWorkplaceType("No mention")).toBe("unspecified");
  });
});

describe("extractSkills", () => {
  it("finds known skills in descriptions", () => {
    const skills = extractSkills(
      "We use React, TypeScript, Next.js, Figma and accessibility (WCAG) daily.",
    );
    expect(skills).toContain("React");
    expect(skills).toContain("TypeScript");
    expect(skills).toContain("Next.js");
    expect(skills).toContain("Figma");
    expect(skills).toContain("Accessibility");
  });
});

describe("normaliseGreenhouseJob", () => {
  const raw: RawGreenhouseJob = {
    id: 12345,
    title: "  Senior Frontend Developer ",
    absolute_url: "https://boards.greenhouse.io/acme/jobs/12345",
    location: { name: "Amsterdam, Netherlands" },
    first_published: "2026-10-01T00:00:00Z",
    content:
      "<p>React and TypeScript required. Salary: €5,000 - €6,000 per month. Visa sponsorship available.</p>",
    departments: [{ name: "Engineering" }],
  };

  it("normalises a Greenhouse job into a draft", () => {
    const draft = normaliseGreenhouseJob(raw, {
      sourceId: "greenhouse__acme",
      boardToken: "acme",
    });
    expect(draft.provider).toBe("greenhouse");
    expect(draft.sourceJobId).toBe("12345");
    expect(draft.title).toBe("Senior Frontend Developer");
    expect(draft.country).toBe("NL");
    expect(draft.city).toBe("Amsterdam");
    expect(draft.salaryMonthlyEurMin).toBe(5000);
    expect(draft.salaryMonthlyEurMax).toBe(6000);
    expect(draft.requiredSkills).toContain("React");
    expect(draft.applicationMethod).toBe("external_apply");
    expect(draft.contentHash).toMatch(/^[a-f0-9]{32}$/);
    expect(draft.publishedAt).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("normaliseLeverJob", () => {
  it("normalises a Lever posting", () => {
    const raw: RawLeverPosting = {
      id: "abc-123",
      text: "Product Designer",
      hostedUrl: "https://jobs.lever.co/company/abc-123",
      applyUrl: "https://jobs.lever.co/company/abc-123/apply",
      categories: { location: "Brussels, Belgium", commitment: "Full-time" },
      descriptionPlain: "Figma, design systems. EU authorisation required.",
      createdAt: Date.UTC(2026, 9, 10),
      workplaceType: "hybrid",
    };
    const draft = normaliseLeverJob(raw, { sourceId: "lever__company", company: "company" });
    expect(draft.provider).toBe("lever");
    expect(draft.country).toBe("BE");
    expect(draft.workplaceType).toBe("hybrid");
    expect(draft.employmentType).toBe("Full-time");
    expect(draft.applicationMethod).toBe("external_apply");
    expect(draft.publishedAt).toBe("2026-10-10T00:00:00.000Z");
  });
});
