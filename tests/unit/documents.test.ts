import { describe, expect, it } from "vitest";
import { buildCvDocument, buildCoverLetterDocument } from "@domain/documents/builders";
import { candidateProfileSchema, type CandidateProfile } from "@domain/schemas/candidate-profile";

function emptyProfile(): CandidateProfile {
  return candidateProfileSchema.parse({ createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
}

const profile = emptyProfile();
profile.contact = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  phone: "+234 800 000 0000",
  currentCity: "Lagos",
  currentCountry: "Nigeria",
  nationality: "Nigerian",
  linkedinUrl: "https://linkedin.com/in/janedoe",
  githubUrl: "https://github.com/janedoe",
  portfolioUrls: [],
};
profile.professionalSummary = "Frontend developer with 5 years of experience building React apps.";
profile.skills = [
  { id: "s1", name: "TypeScript", category: "language", yearsExperience: 5, provenance: "user-asserted" },
  { id: "s2", name: "React", category: "framework", yearsExperience: 4, provenance: "user-asserted" },
];
profile.workExperience = [
  {
    id: "w1",
    jobTitle: "Frontend Developer",
    employer: "Acme Corp",
    location: "Lagos",
    employmentType: "full-time",
    startDate: "2021-06",
    endDate: "",
    isCurrent: true,
    description: "Built customer-facing dashboards.\nLed migration to TypeScript.",
    technologies: ["React", "TypeScript", "Next.js"],
    provenance: "user-asserted",
  },
];
profile.education = [
  {
    id: "e1",
    institution: "University of Lagos",
    qualification: "BSc Computer Science",
    fieldOfStudy: "Computer Science",
    startDate: "2015",
    endDate: "2019",
    description: "",
    provenance: "user-asserted",
  },
];
profile.projects = [
  {
    id: "p1",
    name: "OpenBoard",
    url: "https://github.com/janedoe/openboard",
    description: "Kanban board for teams.",
    technologies: ["React", "Firebase"],
    role: "Creator",
    startDate: "2023",
    endDate: "2024",
    provenance: "user-asserted",
  },
];
profile.certifications = [
  {
    id: "c1",
    name: "AWS Cloud Practitioner",
    issuer: "Amazon",
    issuedDate: "2024-03",
    expiresDate: "",
    credentialUrl: "https://aws.amazon.com/verify/123",
    provenance: "user-asserted",
  },
];
profile.languages = [
  { id: "l1", language: "English", proficiency: "native", provenance: "user-asserted" },
  { id: "l2", language: "Dutch", proficiency: "basic", provenance: "user-asserted" },
];

describe("buildCvDocument", () => {
  it("includes name, contact, skills, experience, education", () => {
    const doc = buildCvDocument(profile);
    expect(doc.title).toContain("Jane Doe");
    const texts = doc.blocks.flatMap((b) =>
      b.type === "heading" || b.type === "paragraph" ? [b.text] : b.type === "kv" ? [b.value] : b.type === "bullets" ? b.items : [],
    );
    expect(texts).toContain("Jane Doe");
    expect(texts.some((t) => t.includes("Acme Corp"))).toBe(true);
    expect(texts.some((t) => t.includes("University of Lagos"))).toBe(true);
    expect(texts.some((t) => t.includes("TypeScript"))).toBe(true);
    expect(texts.some((t) => t.includes("OpenBoard"))).toBe(true);
    expect(texts.some((t) => t.includes("AWS Cloud Practitioner"))).toBe(true);
  });

  it("omits empty sections rather than filling placeholders", () => {
    const empty = emptyProfile();
    const doc = buildCvDocument(empty);
    const headings = doc.blocks.filter((b) => b.type === "heading").map((b) => (b.type === "heading" ? b.text : ""));
    // No section headings should appear for an empty profile
    expect(headings.filter((h) => ["Skills", "Work Experience", "Education", "Projects", "Certifications", "Languages"].includes(h))).toHaveLength(0);
  });
});

describe("buildCoverLetterDocument", () => {
  const job = { title: "Senior Frontend Engineer", employerName: "Adyen", location: "Amsterdam", city: "Amsterdam", country: "NL" };

  it("references the real job and employer", () => {
    const doc = buildCoverLetterDocument({ profile, job });
    const texts = doc.blocks.flatMap((b) => (b.type === "paragraph" || b.type === "heading" ? [b.text] : []));
    expect(texts.some((t) => t.includes("Senior Frontend Engineer"))).toBe(true);
    expect(texts.some((t) => t.includes("Adyen"))).toBe(true);
    expect(texts.some((t) => t.includes("Amsterdam"))).toBe(true);
  });

  it("weaves in real profile skills and latest role", () => {
    const doc = buildCoverLetterDocument({ profile, job });
    const texts = doc.blocks.flatMap((b) => (b.type === "paragraph" ? [b.text] : []));
    expect(texts.some((t) => t.includes("Frontend Developer") && t.includes("Acme Corp"))).toBe(true);
    expect(texts.some((t) => t.includes("TypeScript"))).toBe(true);
  });

  it("includes a review reminder so drafts are never treated as final", () => {
    const doc = buildCoverLetterDocument({ profile, job });
    const texts = doc.blocks.flatMap((b) => (b.type === "paragraph" ? [b.text] : []));
    expect(texts.some((t) => t.includes("Review this draft"))).toBe(true);
  });
});
