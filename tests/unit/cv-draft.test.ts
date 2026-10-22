import { describe, expect, it } from "vitest";
import {
  parseCvDraft,
  mergeDraftIntoProfile,
  normaliseCvDate,
  normaliseUrl,
  draftSectionCounts,
  cvProfileDraftSchema,
  type CvMergeSelections,
} from "@domain/profile/cv-draft";
import { candidateProfileSchema, type CandidateProfile } from "@domain/schemas/candidate-profile";

const SAMPLE_CV = `ADA OKONKWO
Lagos, Nigeria · ada.okonkwo@example.com · +234 803 123 4567
linkedin.com/in/adaokonkwo · github.com/adaok · ada.dev

PROFESSIONAL SUMMARY
Product-minded frontend engineer with 6 years building accessible web apps.

SKILLS
React, Next.js, TypeScript, CSS, Tailwind CSS, Figma, GraphQL, Docker

EXPERIENCE
Senior Frontend Engineer
Acme BV, Amsterdam                                  Jan 2022 – Present
• Led migration to Next.js App Router
• Built design system used by 4 product teams
Technologies: React, TypeScript, Next.js

Frontend Developer
Beta Ltd, Lagos                                     Mar 2019 – Dec 2021
• Shipped customer dashboard in Bubble
Technologies: JavaScript, Bubble

EDUCATION
BSc Computer Science, University of Lagos            2015 – 2019

PROJECTS
RelocateOS — AI job discovery platform (2024 – Present)
• Next.js app for job seekers
https://relocateos.example.com
Technologies: Next.js, TypeScript, Firebase

ShipMate — logistics dashboard (2023)
Technologies: React, Node.js

LANGUAGES
English (Native)
Yoruba – Conversational

CERTIFICATIONS
AWS Certified Cloud Practitioner — Amazon, 2023
`;

function baseProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return candidateProfileSchema.parse({
    contact: { fullName: "", email: "", phone: "" },
    updatedAt: "2026-10-21T00:00:00.000Z",
    createdAt: "2026-10-21T00:00:00.000Z",
    ...overrides,
  });
}

const allOn: CvMergeSelections = {
  contact: true, summary: true, workExperience: true, education: true,
  skills: true, languages: true, projects: true, certifications: true,
};

describe("normaliseCvDate", () => {
  it("accepts the formats real CVs use", () => {
    expect(normaliseCvDate("2022")).toBe("2022");
    expect(normaliseCvDate("2022-01")).toBe("2022-01");
    expect(normaliseCvDate("Jan 2022")).toBe("2022-01");
    expect(normaliseCvDate("January 2022")).toBe("2022-01");
    expect(normaliseCvDate("03/2019")).toBe("2019-03");
    expect(normaliseCvDate("3/2019")).toBe("2019-03");
    expect(normaliseCvDate("2019 Sep")).toBe("2019-09");
  });
  it("returns null rather than guessing", () => {
    expect(normaliseCvDate("sometime in 2020")).toBeNull();
    expect(normaliseCvDate("Present")).toBeNull();
    expect(normaliseCvDate("")).toBeNull();
    expect(normaliseCvDate("13/2019")).toBeNull();
  });
});

describe("normaliseUrl", () => {
  it("accepts AI echoes of bare domains and noisy values", () => {
    expect(normaliseUrl("linkedin.com/in/ada")).toBe("https://linkedin.com/in/ada");
    expect(normaliseUrl("https://github.com/ada")).toBe("https://github.com/ada");
    expect(normaliseUrl("www.linkedin.com/in/ada")).toBe("https://www.linkedin.com/in/ada");
    expect(normaliseUrl("linkedin.com/in/ada · github.com/ada")).toBe("https://linkedin.com/in/ada");
    expect(normaliseUrl("github.com/ada.")).toBe("https://github.com/ada");
  });
});

describe("parseCvDraft (deterministic)", () => {
  const draft = parseCvDraft(SAMPLE_CV);

  it("passes its own draft schema", () => {
    expect(cvProfileDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("extracts reliable contact facts", () => {
    expect(draft.contact.fullName).toBe("ADA OKONKWO");
    expect(draft.contact.email).toBe("ada.okonkwo@example.com");
    expect(draft.contact.phone).toContain("+234");
    expect(draft.contact.linkedinUrl).toContain("linkedin.com/in/adaokonkwo");
    expect(draft.contact.githubUrl).toContain("github.com/adaok");
  });

  it("extracts the portfolio URL from the contact header, excluding linkedin/github/email host", () => {
    expect(draft.contact.portfolioUrls).toEqual(["https://ada.dev"]);
  });

  it("extracts projects with description, url and technologies", () => {
    expect(draft.projects).toHaveLength(2);
    const ro = draft.projects.find((p) => p.name === "RelocateOS");
    expect(ro?.description).toContain("AI job discovery platform");
    expect(ro?.description).toContain("Next.js app for job seekers");
    expect(ro?.url).toBe("https://relocateos.example.com");
    expect(ro?.technologies).toContain("Next.js");
    expect(ro?.technologies).toContain("TypeScript");
    expect(ro?.technologies).toContain("Firebase");
    const sm = draft.projects.find((p) => p.name === "ShipMate");
    expect(sm?.description).toContain("logistics dashboard");
    expect(sm?.url).toBe("");
    expect(sm?.technologies).toContain("Node.js");
  });

  it("extracts certifications with issuer and issued year", () => {
    expect(draft.certifications).toHaveLength(1);
    const cert = draft.certifications[0]!;
    expect(cert.name).toBe("AWS Certified Cloud Practitioner");
    expect(cert.issuer).toBe("Amazon");
    expect(cert.issuedDate).toBe("2023");
  });

  it("captures the summary section", () => {
    expect(draft.professionalSummary).toContain("frontend engineer");
  });

  it("extracts skills from the section plus technology scan", () => {
    const names = draft.skills.map((s) => s.name.toLowerCase());
    expect(names).toContain("react");
    expect(names).toContain("typescript");
    expect(names).toContain("docker");
  });

  it("splits experience entries on date-range lines with normalised dates", () => {
    expect(draft.workExperience.length).toBeGreaterThanOrEqual(2);
    const senior = draft.workExperience.find((w) => w.jobTitle.includes("Senior"));
    expect(senior).toBeDefined();
    expect(senior?.employer).toContain("Acme BV");
    expect(senior?.startDate).toBe("2022-01");
    expect(senior?.isCurrent).toBe(true);
    expect(senior?.description).toContain("Next.js App Router");
    const older = draft.workExperience.find((w) => w.employer.includes("Beta"));
    expect(older?.startDate).toBe("2019-03");
    expect(older?.endDate).toBe("2021-12");
  });

  it("parses languages with levels", () => {
    expect(draft.languages.some((l) => l.language === "English" && l.proficiency === "native")).toBe(true);
    expect(draft.languages.some((l) => l.language === "Yoruba")).toBe(true);
  });
});

describe("mergeDraftIntoProfile", () => {
  it("fills empty contact fields, appends entries with pending-review provenance", () => {
    const profile = baseProfile();
    const draft = parseCvDraft(SAMPLE_CV);
    const res = mergeDraftIntoProfile(profile, draft, allOn);

    expect(res.profile.contact.fullName).toBe("ADA OKONKWO");
    expect(res.profile.contact.email).toBe("ada.okonkwo@example.com");
    expect(res.profile.contact.portfolioUrls).toContain("https://ada.dev");
    expect(res.applied.workExperience).toBeGreaterThanOrEqual(2);
    expect(res.applied.skills).toBeGreaterThan(0);
    expect(res.profile.workExperience.every((w) => w.provenance === "imported-pending-review")).toBe(true);
    expect(res.profile.skills[0]?.provenance).toBe("imported-pending-review");
    // merge must produce a schema-valid profile
    expect(candidateProfileSchema.safeParse(res.profile).success).toBe(true);
  });

  it("never overwrites existing user values — logs conflicts instead", () => {
    const profile = baseProfile();
    profile.contact.email = "user@own-value.com";
    const draft = parseCvDraft(SAMPLE_CV);
    const res = mergeDraftIntoProfile(profile, draft, allOn);
    expect(res.profile.contact.email).toBe("user@own-value.com");
    expect(res.conflicts.some((c) => c.includes("user@own-value.com"))).toBe(true);
    expect(res.profile.contact.fullName).toBe("ADA OKONKWO"); // empty → filled
  });

  it("skips experience with unparsable dates, honestly reported", () => {
    const profile = baseProfile();
    const draft = parseCvDraft(SAMPLE_CV);
    draft.workExperience.push({
      jobTitle: "Mystery Role", employer: "NoDate Inc", location: "",
      startDate: "sometime", endDate: "", isCurrent: false,
      description: "", technologies: [],
    });
    const res = mergeDraftIntoProfile(profile, draft, allOn);
    expect(res.profile.workExperience.some((w) => w.employer === "NoDate Inc")).toBe(false);
    expect(res.skipped.some((s) => s.includes("Mystery Role") && s.includes("not parsable"))).toBe(true);
  });

  it("deduplicates on re-apply (idempotent)", () => {
    const profile = baseProfile();
    const draft = parseCvDraft(SAMPLE_CV);
    const first = mergeDraftIntoProfile(profile, draft, allOn);
    const second = mergeDraftIntoProfile(first.profile, draft, allOn);
    expect(second.profile.workExperience.length).toBe(first.profile.workExperience.length);
    expect(second.profile.skills.length).toBe(first.profile.skills.length);
    expect(second.profile.contact.portfolioUrls).toEqual(first.profile.contact.portfolioUrls);
    expect(second.applied.workExperience ?? 0).toBe(0);
  });

  it("appends portfolio URLs without overwriting, dedupes, skips invalid honestly", () => {
    const profile = baseProfile();
    profile.contact.portfolioUrls = ["https://mysite.com"];
    const draft = parseCvDraft(SAMPLE_CV);
    draft.contact.portfolioUrls.push("ADA.DEV", "not a url", "https://mysite.com");
    const res = mergeDraftIntoProfile(profile, draft, allOn);
    // existing user URL kept, new ones appended
    expect(res.profile.contact.portfolioUrls).toContain("https://mysite.com");
    expect(res.profile.contact.portfolioUrls).toContain("https://ada.dev");
    // case-insensitive dedupe — mysite.com appears once
    expect(res.profile.contact.portfolioUrls.filter((u) => u.toLowerCase().includes("mysite.com"))).toHaveLength(1);
    // invalid entries skipped with an honest reason, never coerced into fake URLs
    expect(res.profile.contact.portfolioUrls.some((u) => u.includes("not"))).toBe(false);
    expect(res.skipped.some((s) => s.includes("not a url"))).toBe(true);
    expect(candidateProfileSchema.safeParse(res.profile).success).toBe(true);
  });

  it("respects section selections — off sections stay untouched", () => {
    const profile = baseProfile();
    profile.skills.push({ id: "s1", name: "Existing", category: "other", yearsExperience: null, provenance: "user-asserted" });
    const draft = parseCvDraft(SAMPLE_CV);
    const onlySkills: CvMergeSelections = { ...allOn, skills: false, contact: false };
    const res = mergeDraftIntoProfile(profile, draft, onlySkills);
    expect(res.profile.skills).toHaveLength(1);
    expect(res.profile.contact.fullName).toBe("");
    expect(res.applied.education).toBeGreaterThanOrEqual(1);
  });
});

describe("draftSectionCounts", () => {
  it("counts non-empty sections for the review UI", () => {
    const draft = parseCvDraft(SAMPLE_CV);
    const counts = draftSectionCounts(draft);
    expect(counts.contact).toBeGreaterThanOrEqual(4);
    expect(counts.workExperience).toBeGreaterThanOrEqual(2);
    expect(counts.skills).toBeGreaterThan(0);
    expect(counts.projects).toBe(2);
    expect(counts.certifications).toBe(1);
  });
});
