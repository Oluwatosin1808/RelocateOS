import "server-only";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jobSchema, type Job, type CountryCode, type JobStatus } from "@domain/schemas/job";
import { jobScoreDocSchema } from "@/lib/jobs/scoring-dal";

export type JobFilters = {
  status?: JobStatus | null;
  country?: CountryCode | null;
  /** Free-text search on title/employer — post-filtered after server-side equality filters. */
  q?: string | null;
  limit?: number;
  /** Cursor: last document id from the previous page. */
  cursor?: string | null;
  /** Sort order for discoveredAt. */
  order?: "desc" | "asc";
  /**
   * Sort by match score descending instead of discoveredAt.
   * Scores live in a separate collection, so this loads the page of jobs
   * first, fetches their scores, and re-orders in memory.
   */
  sortByScore?: boolean;
};

export type JobListPage = {
  jobs: Job[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Paginated job list with server-side equality filters (status, country).
 * `q` is a free-text needle applied in-memory after the equality filters
 * (Firestore has no full-text index); the equality filters already bound the
 * result set so the in-memory pass stays cheap.
 *
 * Pagination uses `startAfter` on (discoveredAt, id) for stable ordering.
 */
export async function listJobs(filters: JobFilters = {}): Promise<JobListPage> {
  // Firestore Admin SDK uses crypto.randomBytes internally — gate at request time.
  await connection();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const order = filters.order ?? "desc";
  const col = adminDb().collection("jobs");

  // Build the base query. Equality filters first, then orderBy discoveredAt.
  // Composite indexes in firestore.indexes.json cover (status, discoveredAt)
  // and (country, discoveredAt).
  let query: FirebaseFirestore.Query = col.orderBy("discoveredAt", order).limit(limit + 1);
  if (filters.status && filters.country) {
    query = col
      .where("status", "==", filters.status)
      .where("country", "==", filters.country)
      .orderBy("discoveredAt", order)
      .limit(limit + 1);
  } else if (filters.status) {
    query = col
      .where("status", "==", filters.status)
      .orderBy("discoveredAt", order)
      .limit(limit + 1);
  } else if (filters.country) {
    query = col
      .where("country", "==", filters.country)
      .orderBy("discoveredAt", order)
      .limit(limit + 1);
  }

  // Cursor pagination via startAfter document snapshot.
  if (filters.cursor) {
    const cursorDoc = await col.doc(filters.cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snap = await query.get();
  const allDocs = snap.docs;
  const pageDocs = allDocs.slice(0, limit);
  const hasMore = allDocs.length > limit;

  const jobs: Job[] = [];
  for (const d of pageDocs) {
    const parsed = jobSchema.safeParse({ id: d.id, ...d.data() });
    if (parsed.success) jobs.push(parsed.data);
  }

  let filtered = jobs;
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    filtered = filtered.filter(
      (j) =>
        j.title.toLowerCase().includes(needle) ||
        j.employerName.toLowerCase().includes(needle) ||
        j.location.toLowerCase().includes(needle) ||
        j.city.toLowerCase().includes(needle),
    );
  }

  // Optional: re-order by match score (descending). Uns scored jobs sink to the bottom.
  if (filters.sortByScore && filtered.length > 0) {
    const scoreSnap = await adminDb()
      .collection("jobScores")
      .where(
        "jobId",
        "in",
        filtered.map((j) => j.id),
      )
      .get();
    const scoreMap = new Map<string, number>();
    for (const d of scoreSnap.docs) {
      const parsed = jobScoreDocSchema.safeParse(d.data());
      if (parsed.success) scoreMap.set(parsed.data.jobId, parsed.data.total);
    }
    filtered = [...filtered].sort((a, b) => (scoreMap.get(b.id) ?? -1) - (scoreMap.get(a.id) ?? -1));
  }

  const nextCursor = hasMore ? (pageDocs[pageDocs.length - 1]?.id ?? null) : null;
  return { jobs: filtered, nextCursor, hasMore };
}

export async function getJob(id: string): Promise<Job | null> {
  await connection();
  const snap = await adminDb().doc(`jobs/${id}`).get();
  if (!snap.exists) return null;
  const parsed = jobSchema.safeParse({ id: snap.id, ...snap.data() });
  return parsed.success ? parsed.data : null;
}

export async function setJobStatus(id: string, status: JobStatus): Promise<void> {
  await adminDb()
    .doc(`jobs/${id}`)
    .set({ status, updatedAt: new Date().toISOString() }, { merge: true });
}

/** Batch update multiple jobs' status (used by shortlist bulk actions later). */
export async function setJobsStatus(ids: string[], status: JobStatus): Promise<number> {
  if (ids.length === 0) return 0;
  const batch = adminDb().batch();
  const now = new Date().toISOString();
  for (const id of ids) {
    batch.set(adminDb().doc(`jobs/${id}`), { status, updatedAt: now }, { merge: true });
  }
  await batch.commit();
  return ids.length;
}
