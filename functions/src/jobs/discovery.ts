import type { Firestore } from "firebase-admin/firestore";
import { planJobUpserts, jobIdFromDraft, type ExistingJobKey } from "../domain/jobs/dedup";
import { buildAdapterForSource, buildSearchQuery } from "../integrations/registry";
import type { CandidateProfile } from "../domain/schemas/candidate-profile";
import type { Job, JobSource } from "../domain/schemas/job";

export type DiscoveryStats = {
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  jobsDiscovered: number;
  jobsInserted: number;
  jobsUpdated: number;
  jobsSkipped: number;
  failures: { sourceId: string; message: string }[];
};

type SimpleLog = {
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
};

async function loadExistingJobKeys(db: Firestore): Promise<ExistingJobKey[]> {
  const snap = await db
    .collection("jobs")
    .select("provider", "sourceJobId", "canonicalUrl", "contentHash", "employerName", "title", "location")
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as Partial<Job>;
    return {
      id: d.id,
      provider: data.provider ?? "",
      sourceJobId: data.sourceJobId ?? "",
      canonicalUrl: data.canonicalUrl ?? "",
      contentHash: data.contentHash ?? "",
      employerName: data.employerName ?? "",
      title: data.title ?? "",
      location: data.location ?? "",
    };
  });
}

async function loadEnabledSources(db: Firestore): Promise<JobSource[]> {
  const snap = await db.collection("jobSources").where("enabled", "==", true).get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<JobSource, "id">), id: d.id }));
}

/**
 * Run discovery across all enabled sources.
 * Idempotent: deterministic job ids + upsert; one failing source never aborts
 * the others; health reflects the truth (never a fabricated success).
 */
export async function runDiscoveryScan(
  db: Firestore,
  profile: CandidateProfile,
  log: SimpleLog,
): Promise<DiscoveryStats> {
  const query = buildSearchQuery(profile);
  const stats: DiscoveryStats = {
    sourcesAttempted: 0,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    jobsDiscovered: 0,
    jobsInserted: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    failures: [],
  };

  const sources = await loadEnabledSources(db);
  if (sources.length === 0) {
    log.info("no_enabled_sources");
    return stats;
  }

  const existing = await loadExistingJobKeys(db);
  const nowIso = new Date().toISOString();

  for (const source of sources) {
    stats.sourcesAttempted += 1;
    const adapter = buildAdapterForSource(source);
    if (!adapter) {
      stats.sourcesFailed += 1;
      stats.failures.push({
        sourceId: source.id,
        message: `No adapter for provider "${source.provider}" or missing configuration.`,
      });
      await db.doc(`jobSources/${source.id}`).set(
        {
          healthStatus: "unconfigured",
          lastFailureAt: nowIso,
          lastFailureReason: "Adapter not constructed — check configuration.",
          updatedAt: nowIso,
        },
        { merge: true },
      );
      continue;
    }

    try {
      const result = await adapter.searchJobs(query);
      const plan = planJobUpserts(result.drafts, existing);
      stats.jobsDiscovered += result.drafts.length;
      stats.jobsInserted += plan.toInsert.length;
      stats.jobsUpdated += plan.toUpdate.length;
      stats.jobsSkipped += plan.skipped.length;

      const batch = db.batch();
      for (const draft of plan.toInsert) {
        const id = jobIdFromDraft(draft);
        const doc: Job = {
          ...draft,
          id,
          status: "discovered",
          discoveredAt: nowIso,
          lastSeenAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        batch.set(db.doc(`jobs/${id}`), doc);
      }
      for (const { existingId, draft } of plan.toUpdate) {
        batch.set(
          db.doc(`jobs/${existingId}`),
          { ...draft, id: existingId, lastSeenAt: nowIso, updatedAt: nowIso },
          { merge: true },
        );
      }
      await batch.commit();

      await db.doc(`jobSources/${source.id}`).set(
        {
          healthStatus: "healthy",
          lastSuccessfulSyncAt: nowIso,
          lastFailureAt: null,
          lastFailureReason: "",
          jobsLastScan: result.drafts.length,
          updatedAt: nowIso,
        },
        { merge: true },
      );
      stats.sourcesSucceeded += 1;
      log.info("source_scan_ok", {
        sourceId: source.id,
        fetched: result.drafts.length,
        inserted: plan.toInsert.length,
        updated: plan.toUpdate.length,
        skipped: plan.skipped.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.sourcesFailed += 1;
      stats.failures.push({ sourceId: source.id, message });
      await db.doc(`jobSources/${source.id}`).set(
        {
          healthStatus: "failing",
          lastFailureAt: nowIso,
          lastFailureReason: message.slice(0, 500),
          updatedAt: nowIso,
        },
        { merge: true },
      );
      log.warn("source_scan_failed", { sourceId: source.id, error: message });
    }
  }

  log.info("discovery_complete", {
    sourcesAttempted: stats.sourcesAttempted,
    sourcesSucceeded: stats.sourcesSucceeded,
    sourcesFailed: stats.sourcesFailed,
    jobsDiscovered: stats.jobsDiscovered,
    jobsInserted: stats.jobsInserted,
  });
  return stats;
}
