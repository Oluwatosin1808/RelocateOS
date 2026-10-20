import "server-only";
import { z } from "zod";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jobSchema, type Job } from "@domain/schemas/job";
import { scoreJob, type JobScore } from "@domain/jobs/scoring";
import { loadCandidateProfile } from "@/lib/profile/dal";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";

export const jobScoreDocSchema = z.object({
  jobId: z.string().min(1),
  total: z.number().int().min(0).max(100),
  components: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      score: z.number(),
      max: z.number(),
      detail: z.string(),
    }),
  ),
  scoredAt: z.string(),
  profileVersion: z.string().optional(),
});
export type JobScoreDoc = z.infer<typeof jobScoreDocSchema>;

export async function getJobScore(jobId: string): Promise<JobScoreDoc | null> {
  await connection();
  const snap = await adminDb().doc(`jobScores/${jobId}`).get();
  if (!snap.exists) return null;
  const parsed = jobScoreDocSchema.safeParse(snap.data());
  return parsed.success ? parsed.data : null;
}

/** Fetch stored scores for a page of jobs in one round-trip (in-batches of 10). */
export async function getJobScores(jobIds: string[]): Promise<Map<string, number>> {
  await connection();
  const scores = new Map<string, number>();
  if (jobIds.length === 0) return scores;
  // Firestore `in` accepts max 30 values; chunk at 10 to stay well under.
  for (let i = 0; i < jobIds.length; i += 10) {
    const chunk = jobIds.slice(i, i + 10);
    const snap = await adminDb()
      .collection("jobScores")
      .where("jobId", "in", chunk)
      .get();
    for (const d of snap.docs) {
      const parsed = jobScoreDocSchema.safeParse(d.data());
      if (parsed.success) scores.set(parsed.data.jobId, parsed.data.total);
    }
  }
  return scores;
}

/**
 * Score a job against the user's profile and persist the result.
 * The score is recomputed on demand; we persist so the list view can show
 * the last-known score without recomputing every job on every page load.
 */
export async function scoreAndPersistJob(
  uid: string,
  jobId: string,
): Promise<{ job: Job; score: JobScore; doc: JobScoreDoc } | null> {
  const [jobSnap, profile] = await Promise.all([
    adminDb().doc(`jobs/${jobId}`).get(),
    loadCandidateProfile(uid),
  ]);
  if (!jobSnap.exists || !profile) return null;
  const jobParsed = jobSchema.safeParse({ id: jobSnap.id, ...jobSnap.data() });
  if (!jobParsed.success) return null;
  const job = jobParsed.data;
  const score = scoreJob(job, profile);
  const doc: JobScoreDoc = {
    jobId,
    total: score.total,
    components: score.components.map((c) => ({
      key: c.key,
      label: c.label,
      score: c.score,
      max: c.max,
      detail: c.detail,
    })),
    scoredAt: score.scoredAt,
    profileVersion: profile.updatedAt,
  };
  await adminDb().doc(`jobScores/${jobId}`).set(doc, { merge: false });
  return { job, score, doc };
}

/** Batch-score a list of jobs (used by the scan worker / analyse action). */
export async function scoreAndPersistJobs(
  uid: string,
  jobs: Job[],
  profile: CandidateProfile,
): Promise<number> {
  if (jobs.length === 0) return 0;
  const batch = adminDb().batch();
  let count = 0;
  for (const job of jobs) {
    const score = scoreJob(job, profile);
    const doc: JobScoreDoc = {
      jobId: job.id,
      total: score.total,
      components: score.components.map((c) => ({
        key: c.key,
        label: c.label,
        score: c.score,
        max: c.max,
        detail: c.detail,
      })),
      scoredAt: score.scoredAt,
      profileVersion: profile.updatedAt,
    };
    batch.set(adminDb().doc(`jobScores/${job.id}`), doc);
    count += 1;
  }
  await batch.commit();
  return count;
}
