import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { getServerEnv } from "@/lib/configuration/env";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { runDiscoveryScan } from "@fn/jobs/discovery";
import { candidateProfileSchema } from "@domain/schemas/candidate-profile";
import { scoreJob } from "@domain/jobs/scoring";
import { jobSchema } from "@domain/schemas/job";

/**
 * POST /api/cron/scan — external-cron-triggered discovery scan.
 *
 * Auth: `Authorization: Bearer <SCHEDULER_SECRET>` or `x-scheduler-secret` header.
 * Runs the same discovery + scoring pipeline as the (Blaze-blocked) Cloud
 * Function, for every onboarded user. Designed to be called by a free external
 * cron service (cron-job.org, UptimeRobot, etc.) every 6 hours.
 *
 * Never exposes the secret in responses. Returns per-user stats for observability.
 */
export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.cron.scan", correlationId });
  const env = getServerEnv();

  if (!env.schedulerSecret) {
    return jsonError(503, "not_configured", "SCHEDULER_SECRET is not set.", correlationId);
  }

  const auth = request.headers.get("authorization") ?? "";
  const secretHeader = request.headers.get("x-scheduler-secret") ?? "";
  // Tolerate missing/mis-cased "Bearer " prefix (cron services differ).
  const normalize = (v: string) => v.replace(/^bearer\s+/i, "").trim();
  const provided = normalize(auth) || normalize(secretHeader);
  if (provided !== env.schedulerSecret) {
    log.warn("cron_scan_unauthorized", {
      providedLength: provided.length,
      expectedLength: env.schedulerSecret.length,
      hasAuthHeader: auth.length > 0,
      hasSchedulerHeader: secretHeader.length > 0,
    });
    return jsonError(401, "unauthorized", "Invalid scheduler secret.", correlationId);
  }

  await connection();
  const usersSnap = await adminDb()
    .collection("users")
    .where("onboardingCompleted", "==", true)
    .limit(50)
    .get();

  log.info("cron_scan_start", { users: usersSnap.size });
  const results: { uid: string; inserted: number; updated: number; failed: string | null }[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    try {
      const profileSnap = await adminDb().doc(`candidateProfiles/${uid}`).get();
      if (!profileSnap.exists) {
        results.push({ uid, inserted: 0, updated: 0, failed: "no_profile" });
        continue;
      }
      const parsed = candidateProfileSchema.safeParse(profileSnap.data());
      if (!parsed.success) {
        results.push({ uid, inserted: 0, updated: 0, failed: "invalid_profile" });
        continue;
      }

      const stats = await runDiscoveryScan(adminDb(), parsed.data, log);

      // Batch-score jobs touched by this scan.
      if (stats.jobsInserted > 0 || stats.jobsUpdated > 0) {
        const recentSnap = await adminDb()
          .collection("jobs")
          .orderBy("updatedAt", "desc")
          .limit(100)
          .get();
        const batch = adminDb().batch();
        let scored = 0;
        for (const d of recentSnap.docs) {
          const jp = jobSchema.safeParse({ id: d.id, ...d.data() });
          if (!jp.success) continue;
          const score = scoreJob(jp.data, parsed.data);
          batch.set(adminDb().doc(`jobScores/${d.id}`), {
            jobId: d.id,
            total: score.total,
            components: score.components.map((c) => ({
              key: c.key, label: c.label, score: c.score, max: c.max, detail: c.detail,
            })),
            scoredAt: score.scoredAt,
            profileVersion: parsed.data.updatedAt,
          });
          scored += 1;
        }
        if (scored > 0) await batch.commit();
      }

      // Notify the user (stored only — Resend path is in the web notification DAL).
      await adminDb().collection("notifications").add({
        uid,
        kind: "scan_complete",
        title: "Scheduled scan complete",
        body: `${stats.jobsDiscovered} seen, ${stats.jobsInserted} new, ${stats.sourcesSucceeded}/${stats.sourcesAttempted} sources ok.`,
        href: "/scout",
        deliveryStatus: "stored",
        providerMessageId: "",
        read: false,
        createdAt: new Date().toISOString(),
      });

      results.push({ uid, inserted: stats.jobsInserted, updated: stats.jobsUpdated, failed: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("cron_scan_user_failed", { uid, error: msg });
      results.push({ uid, inserted: 0, updated: 0, failed: msg.slice(0, 200) });
    }
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  log.info("cron_scan_complete", { users: results.length, totalInserted, totalUpdated });

  return jsonOk({
    ok: true,
    usersProcessed: results.length,
    totalInserted,
    totalUpdated,
    results,
  });
}
