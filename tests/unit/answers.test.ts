import { describe, expect, it } from "vitest";
import { buildStandardAnswers, renderAnswersSheet } from "@domain/applications/answers";
import { candidateProfileSchema, type CandidateProfile } from "@domain/schemas/candidate-profile";
import { createZip, crc32 } from "../../src/lib/zip/store-zip";

const job = {
  title: "Frontend Developer",
  employerName: "Acme BV",
  location: "Amsterdam, Netherlands",
  requiredSkills: ["React", "TypeScript"],
  preferredSkills: ["Next.js"],
};

function makeProfile(overrides: Record<string, unknown> = {}): CandidateProfile {
  return candidateProfileSchema.parse({
    contact: {
      fullName: "Ada Example",
      email: "ada@example.com",
      phone: "+234 800 000 0000",
      currentCity: "Lagos",
      currentCountry: "Nigeria",
      nationality: "Nigerian",
      linkedinUrl: "https://linkedin.com/in/ada",
    },
    workAuthorisation: { requiresEmployerSponsorship: true, noticePeriodWeeks: 4 },
    salaryPreferences: { minGrossMonthlyEur: 4000 },
    relocationPreferences: { targetCountries: ["NL"] },
    skills: [
      { id: "s1", name: "React" },
      { id: "s2", name: "TypeScript" },
      { id: "s3", name: "Figma" },
    ],
    workExperience: [
      {
        id: "w1",
        jobTitle: "UI Engineer",
        employer: "Beta Ltd",
        startDate: "2023-01",
        endDate: "",
        isCurrent: true,
      },
    ],
    languages: [{ id: "l1", language: "English", proficiency: "fluent" }],
    updatedAt: "2026-10-21T00:00:00.000Z",
    createdAt: "2026-10-21T00:00:00.000Z",
    ...overrides,
  });
}

describe("buildStandardAnswers", () => {
  it("derives every value from confirmed profile facts", () => {
    const answers = buildStandardAnswers(makeProfile(), job);
    const byKey = Object.fromEntries(answers.map((a) => [a.key, a]));

    expect(byKey.full_name?.value).toBe("Ada Example");
    expect(byKey.email?.value).toBe("ada@example.com");
    expect(byKey.work_authorisation?.value).toMatch(/require employer-sponsored work authorisation/);
    expect(byKey.work_authorisation?.value).toMatch(/the Netherlands/);
    expect(byKey.notice_period?.value).toBe("4 weeks");
    expect(byKey.salary_expectation?.value).toContain("€4,000");
    expect(byKey.earliest_start?.value).toMatch(/\d+–\d+ months/);
  });

  it("surfaces overlap facts for 'why this role' without inventing prose", () => {
    const answers = buildStandardAnswers(makeProfile(), job);
    const why = answers.find((a) => a.key === "why_facts");
    expect(why?.value).toContain("UI Engineer at Beta Ltd");
    expect(why?.value).toContain("React, TypeScript"); // real skill overlap
    expect(why?.value).not.toContain("I am passionate"); // no fabricated narrative
  });

  it("marks missing facts honestly instead of guessing", () => {
    const profile = makeProfile();
    profile.workAuthorisation.noticePeriodWeeks = null;
    profile.contact.fullName = "";
    const answers = buildStandardAnswers(profile, job);
    const byKey = Object.fromEntries(answers.map((a) => [a.key, a]));
    expect(byKey.notice_period?.value).toMatch(/NOT ON PROFILE/);
    expect(byKey.notice_period?.source).toBe("missing");
    expect(byKey.full_name?.value).toMatch(/NOT ON PROFILE/);
  });

  it("states EU permit holders differently from sponsorship cases", () => {
    const profile = makeProfile();
    profile.workAuthorisation.hasEuWorkPermit = true;
    profile.workAuthorisation.euPermitDetails = "Dutch residence permit, valid to 2028";
    const answers = buildStandardAnswers(profile, job);
    const workAuth = answers.find((a) => a.key === "work_authorisation");
    expect(workAuth?.value).toContain("Dutch residence permit");
    expect(workAuth?.value).not.toContain("require employer-sponsored");
  });

  it("renders a copy-paste answers sheet", () => {
    const answers = buildStandardAnswers(makeProfile(), job);
    const sheet = renderAnswersSheet(answers, job);
    expect(sheet).toContain("Ada Example");
    expect(sheet).toContain("Frontend Developer at Acme BV");
    expect(sheet).toContain("WORK AUTHORISATION");
  });
});

describe("createZip", () => {
  it("computes the standard CRC-32 check vector", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("produces a valid store-method archive with local + central headers", () => {
    const zip = createZip([
      { name: "a.txt", data: Buffer.from("hello") },
      { name: "b.txt", data: Buffer.from("world!") },
    ]);
    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304"); // PK\x03\x04
    expect(zip.includes(Buffer.from("a.txt"))).toBe(true);
    expect(zip.includes(Buffer.from("b.txt"))).toBe(true);
    // EOCD signature at the end (22 bytes, no comment)
    expect(zip.subarray(zip.length - 22, zip.length - 18).toString("hex")).toBe("504b0506");
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2); // entry count
  });
});
