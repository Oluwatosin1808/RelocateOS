import { canonicaliseUrl, titleSimilarity } from "./hash";
import type { NormalisedJobDraft } from "../schemas/job";

export type ExistingJobKey = {
  id: string;
  provider: string;
  sourceJobId: string;
  canonicalUrl: string;
  contentHash: string;
  employerName: string;
  title: string;
  location: string;
};

export type DedupDecision =
  | { action: "insert"; reason: "new" }
  | { action: "update"; existingId: string; reason: "same_source_id" | "same_canonical_url" | "same_content_hash" }
  | { action: "skip"; existingId: string; reason: "near_duplicate" };

export function jobIdFromDraft(draft: NormalisedJobDraft): string {
  const slug = draft.sourceJobId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${draft.provider}__${slug}`;
}

/**
 * Decide how a discovered draft relates to already-stored jobs.
 * Application history is NEVER deleted — merges only update the job record.
 */
export function classifyDuplicate(
  draft: NormalisedJobDraft,
  existing: ExistingJobKey[],
  options: { nearDuplicateThreshold?: number } = {},
): DedupDecision {
  const threshold = options.nearDuplicateThreshold ?? 0.92;
  const id = jobIdFromDraft(draft);
  const incomingCanonical = draft.canonicalUrl ? canonicaliseUrl(draft.canonicalUrl) : "";

  // 1. Same provider + source job id (primary key).
  const bySourceId = existing.find(
    (e) => e.provider === draft.provider && e.sourceJobId === draft.sourceJobId,
  );
  if (bySourceId) {
    return { action: "update", existingId: bySourceId.id, reason: "same_source_id" };
  }

  // 2. Same canonical application URL.
  if (incomingCanonical) {
    const byUrl = existing.find(
      (e) => e.canonicalUrl && canonicaliseUrl(e.canonicalUrl) === incomingCanonical,
    );
    if (byUrl) {
      return { action: "update", existingId: byUrl.id, reason: "same_canonical_url" };
    }
  }

  // 3. Same content hash (same employer/title/location/description).
  const byHash = existing.find((e) => e.contentHash === draft.contentHash);
  if (byHash) {
    return { action: "update", existingId: byHash.id, reason: "same_content_hash" };
  }

  // 4. Near-duplicate titles at the same employer (secondary signal only).
  const near = existing.find((e) => {
    const sameEmployer =
      e.employerName.toLowerCase() === draft.employerName.toLowerCase();
    if (!sameEmployer) return false;
    const sim = titleSimilarity(e.title, draft.title);
    return sim >= threshold;
  });
  if (near) {
    return { action: "skip", existingId: near.id, reason: "near_duplicate" };
  }

  return { action: "insert", reason: "new" };
}

export interface UpsertOutcome {
  toInsert: NormalisedJobDraft[];
  toUpdate: { existingId: string; draft: NormalisedJobDraft; reason: string }[];
  skipped: { existingId: string; draft: NormalisedJobDraft; reason: string }[];
}

export function planJobUpserts(
  drafts: NormalisedJobDraft[],
  existing: ExistingJobKey[],
): UpsertOutcome {
  const outcome: UpsertOutcome = { toInsert: [], toUpdate: [], skipped: [] };
  let known: ExistingJobKey[] = [...existing];

  for (const draft of drafts) {
    const decision = classifyDuplicate(draft, known);
    if (decision.action === "insert") {
      outcome.toInsert.push(draft);
      known = [
        ...known,
        {
          id: jobIdFromDraft(draft),
          provider: draft.provider,
          sourceJobId: draft.sourceJobId,
          canonicalUrl: draft.canonicalUrl,
          contentHash: draft.contentHash,
          employerName: draft.employerName,
          title: draft.title,
          location: draft.location,
        },
      ];
    } else if (decision.action === "update") {
      outcome.toUpdate.push({ existingId: decision.existingId, draft, reason: decision.reason });
    } else {
      outcome.skipped.push({ existingId: decision.existingId, draft, reason: decision.reason });
    }
  }
  return outcome;
}
