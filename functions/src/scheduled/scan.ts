import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { runDiscoveryScan } from "../jobs/discovery";
import { scoreAndPersistJobs } from "../jobs/scoring-worker";
import { candidateProfileSchema } from "../domain/schemas/candidate-profile";

function initAdmin() {
  if (getApps().length > 0) return;
  const env = process.env;
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    initializeApp();
  }
}

/**
 * Scheduled discovery scan — runs every 6 hours.
 * For each user with onboarding completed:
 * 1. Load their profile and enabled sources.
 * 2. Run discovery (idempotent upsert).
 * 3. Batch-score new/updated jobs against their profile.
 * 4. Persist a scan summary notification.
 *
 * Uses the shared `runDiscoveryScan` so scheduled and manual scans behave
 * identically — no drift between paths.
 */
export const scheduledScan = onSchedule(
  {
    schedule: "every 6 hours",
    region: "europe-west4",
    timeZone: "UTC",
  },
  async () => {
    initAdmin();
    const db = getFirestore();
    const log = {
      info: (msg: string, fields?: Record<string, unknown>) => logger.info(msg, fields),
      warn: (msg: string, fields?: Record<string, unknown>) => logger.warn(msg, fields),
    };

    // Find users who completed onboarding.
    const usersSnap = await db
      .collection("users")
      .where("onboardingCompleted", "==", true)
      .limit(50)
      .get();

    logger.info("scheduled_scan_start", { users: usersSnap.size });

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      try {
        const profileSnap = await db.doc(`candidateProfiles/${uid}`).get();
        if (!profileSnap.exists) continue;
        const parsed = candidateProfileSchema.safeParse(profileSnap.data());
        if (!parsed.success) {
          log.warn("scheduled_scan_invalid_profile", { uid });
          continue;
        }
        const profile = parsed.data;

        const stats = await runDiscoveryScan(db, profile, log);

        // Batch-score the jobs this scan touched (inserted + updated).
        if (stats.jobsInserted > 0 || stats.jobsUpdated > 0) {
          const recentJobsSnap = await db
            .collection("jobs")
            .orderBy("updatedAt", "desc")
            .limit(100)
            .get();
          const { jobSchema } = await import("../domain/schemas/job");
          const jobs = recentJobsSnap.docs
            .map((d) => {
              const p = jobSchema.safeParse({ id: d.id, ...d.data() });
              return p.success ? p.data : null;
            })
            .filter((j): j is NonNullable<typeof j> => j !== null);
          await scoreAndPersistJobs(uid, jobs, profile, db);
        }

        // Notify the user of the scan result.
        const summary =
          `Scan complete: ${stats.jobsDiscovered} seen, ${stats.jobsInserted} new, ` +
          `${stats.sourcesSucceeded}/${stats.sourcesAttempted} sources ok.`;
        await db.collection("notifications").add({
          uid,
          kind: "scan_complete",
          title: "Scheduled scan complete",
          body: summary,
          href: "/scout",
          deliveryStatus: "stored",
          providerMessageId: "",
          read: false,
          createdAt: new Date().toISOString(),
        });

        logger.info("scheduled_scan_user_done", {
          uid,
          inserted: stats.jobsInserted,
          updated: stats.jobsUpdated,
        });
      } catch (err) {
        logger.error("scheduled_scan_user_failed", {
          uid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("scheduled_scan_complete", {});
  },
);
