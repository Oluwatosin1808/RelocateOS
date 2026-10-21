import { describe, expect, it } from "vitest";
import { locationMatches } from "@fn/integrations/location";
import { buildSearchQuery } from "@fn/integrations/registry";
import { candidateProfileSchema } from "@domain/schemas/candidate-profile";

const nlBe = { countries: ["NL" as const, "BE" as const], cities: [] as string[] };

describe("locationMatches", () => {
  it("passes everything when no city/country constraints are set", () => {
    expect(locationMatches({ location: "Remote, United States", city: "SF" }, { ...nlBe, countries: [], cities: [] })).toBe(true);
  });

  it("matches country by name alias (Netherlands, Belgium)", () => {
    expect(locationMatches({ location: "Remote, Netherlands", city: "" }, nlBe)).toBe(true);
    expect(locationMatches({ location: "the netherlands", city: "" }, nlBe)).toBe(true);
    expect(locationMatches({ location: "Belgium", city: "" }, nlBe)).toBe(true);
  });

  it("does not match unrelated countries", () => {
    expect(locationMatches({ location: "Remote, United States", city: "SF" }, nlBe)).toBe(false);
    expect(locationMatches({ location: "Remote, France; Remote, Germany", city: "" }, nlBe)).toBe(false);
  });

  it("matches multi-location postings when ANY segment is in scope", () => {
    expect(
      locationMatches(
        { location: "remote, france; remote, netherlands; remote, united kingdom", city: "" },
        nlBe,
      ),
    ).toBe(true);
  });

  it("word-boundary-matches codes without matching substrings", () => {
    expect(locationMatches({ location: "NL", city: "" }, nlBe)).toBe(true);
    expect(locationMatches({ location: "Online", city: "" }, nlBe)).toBe(false);
    expect(locationMatches({ location: "Beijing", city: "" }, nlBe)).toBe(false);
  });

  it("keeps genuinely global remote only when allowed", () => {
    expect(locationMatches({ location: "Remote", city: "" }, { ...nlBe, includeGlobalRemote: true })).toBe(true);
    expect(locationMatches({ location: "Remote (Worldwide)", city: "" }, { ...nlBe, includeGlobalRemote: true })).toBe(true);
    expect(locationMatches({ location: "Remote", city: "" }, { ...nlBe, includeGlobalRemote: false })).toBe(false);
  });

  it("matches configured cities by substring", () => {
    expect(locationMatches({ location: "Amsterdam, Netherlands", city: "" }, { countries: [], cities: ["amsterdam"] })).toBe(true);
  });
});

describe("buildSearchQuery", () => {
  const base = {
    updatedAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-19T00:00:00.000Z",
  };

  it("uses role families and skills as keywords; never sponsorship phrases", () => {
    const profile = candidateProfileSchema.parse({
      ...base,
      searchPreferences: {
        roleFamilies: [
          { id: "fe", title: "Frontend Developer", synonyms: ["UI Engineer"], technologies: ["React"], enabled: true },
        ],
        skillsKeywordPool: ["TypeScript"],
      },
      relocationPreferences: { targetCountries: ["NL"], workplaceTypes: ["remote"] },
    });
    const q = buildSearchQuery(profile);
    expect(q.keywords).toContain("Frontend Developer");
    expect(q.keywords).toContain("TypeScript");
    expect(q.keywords).not.toContain("visa sponsorship");
    expect(q.includeGlobalRemote).toBe(true);
  });

  it("falls back to no keyword gate when the profile has no role/skill pools", () => {
    const profile = candidateProfileSchema.parse({
      ...base,
      searchPreferences: { roleFamilies: [], skillsKeywordPool: [] },
      relocationPreferences: { targetCountries: ["NL", "BE"], workplaceTypes: ["hybrid"] },
    });
    const q = buildSearchQuery(profile);
    expect(q.keywords).toEqual([]);
    expect(q.includeGlobalRemote).toBe(false);
  });
});
