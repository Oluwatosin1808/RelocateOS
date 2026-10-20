import { createHash } from "node:crypto";

/** Deterministic content hash for duplicate detection (secondary signal). */
export function jobContentHash(parts: {
  employerName: string;
  title: string;
  location: string;
  description: string;
}): string {
  const normalised = [
    parts.employerName.toLowerCase().replace(/\s+/g, " ").trim(),
    parts.title.toLowerCase().replace(/\s+/g, " ").trim(),
    parts.location.toLowerCase().replace(/\s+/g, " ").trim(),
    parts.description.toLowerCase().replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 2000),
  ].join("|");
  return createHash("sha256").update(normalised).digest("hex").slice(0, 32);
}

/** Strip tracking params and normalise for canonical comparison. */
export function canonicaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const tracking = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ref",
      "source",
    ];
    for (const key of tracking) u.searchParams.delete(key);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hostname = host;
    const path = u.pathname.replace(/\/+$/, "");
    u.pathname = path || "/";
    return u.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Token set for similarity comparison. */
export function titleTokenSet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

/** Jaccard similarity between two titles (0..1). Secondary dedup signal. */
export function titleSimilarity(a: string, b: string): number {
  const setA = titleTokenSet(a);
  const setB = titleTokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}
