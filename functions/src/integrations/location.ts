import type { JobSearchQuery } from "../domain/schemas/job";

/**
 * Country code → location-name aliases used for substring matching against
 * ATS location strings ("Remote, Netherlands", "the netherlands", "BE").
 * Codes that already read as words (NL, BE) are also matched word-boundary
 * safe so "online" never matches "NL".
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  NL: ["netherlands", "the netherlands", "holland", "\\bnl\\b"],
  BE: ["belgium", "belgie", "belgië", "\\bbe\\b"],
};

function locationBlob(draft: { location: string; city: string }): string {
  return `${draft.location} ${draft.city}`.toLowerCase();
}

/** Genuinely global postings: "Remote", "Remote (Worldwide)", "Anywhere". */
function isGlobalRemote(location: string): boolean {
  const t = location.trim().toLowerCase();
  return /^remote(\s*\(.*\))?$/.test(t) || t === "anywhere" || t === "worldwide";
}

/**
 * Shared location gate for all ATS adapters. A posting passes when:
 *  - no city/country constraints are configured, or
 *  - its location/city contains any configured city, or
 *  - its location matches any target country (alias or word-boundary code), or
 *  - it is location-independent ("Remote") and the query allows global remote.
 * Multi-location strings ("Remote, France; Remote, Netherlands") pass when ANY
 * segment matches.
 */
export function locationMatches(
  draft: { location: string; city: string },
  query: Pick<JobSearchQuery, "cities" | "countries" | "includeGlobalRemote">,
): boolean {
  if (query.cities.length === 0 && query.countries.length === 0) return true;

  const blob = locationBlob(draft);
  // Segment multi-location strings so "Remote, France; Remote, Netherlands"
  // matches per segment rather than by naive substring across the whole blob.
  const segments = blob.split(/[;,]/).map((s) => s.trim()).filter(Boolean);

  for (const city of query.cities.map((c) => c.toLowerCase())) {
    if (segments.some((s) => s.includes(city))) return true;
  }

  for (const code of query.countries) {
    const aliases = COUNTRY_ALIASES[code];
    if (!aliases) continue; // OTHER carries no name — cannot match literally
    for (const alias of aliases) {
      if (alias.startsWith("\\b")) {
        const re = new RegExp(alias, "i");
        if (segments.some((s) => re.test(s))) return true;
      } else if (segments.some((s) => s.includes(alias))) {
        return true;
      }
    }
  }

  if (query.includeGlobalRemote && segments.some((s) => isGlobalRemote(s))) {
    return true;
  }

  return false;
}
