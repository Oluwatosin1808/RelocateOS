import type { Firestore } from "firebase-admin/firestore";
import { scoreJob } from "../domain/jobs/scoring";
import type { CandidateProfile } from "../domain/schemas/candidate-profile";
import type { Job } from "../domain/schemas/job";

type SimpleLog = {
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
};

/**
 * Batch-score jobs against a profile and persist to jobScores/{jobId}.
 * Used by the scheduled scan worker (functions-internal; relative imports only).
 */
export async function scoreAndPersistJobs(
  uid: string,
  jobs: Job[],
  profile: CandidateProfile,
  db: Firestore,
): Promise<number> {
  if (jobs.length === 0) return 0;
  const batch = db.batch();
  let count = 0;
  for (const job of jobs) {
    const score = scoreJob(job, profile);
    const doc = {
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
    batch.set(db.doc(`jobScores/${job.id}`), doc);
    count += 1;
  }
  await batch.commit();
  return count;
}
