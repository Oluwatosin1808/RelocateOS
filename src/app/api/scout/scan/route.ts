import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { runDiscoveryScan } from "@fn/jobs/discovery";

const log = createLogger({ module: "api.scout.scan" });

export const maxDuration = 120;

/**
 * Trigger a discovery scan across all enabled job sources.
 * Writes real jobs into Firestore via the shared `runDiscoveryScan` function.
 * One failing source never aborts the others; health reflects the truth.
 */
export async function POST() {
  const correlationId = newCorrelationId();
  const scanLog = createLogger({ module: "api.scout.scan", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const profile = await loadCandidateProfile(user.uid);
  if (!profile) {
    return jsonError(
      409,
      "no_profile",
      "Complete onboarding and save your profile before scanning.",
      correlationId,
    );
  }
  scanLog.info("scan_started", { uid: user.uid });
  const stats = await runDiscoveryScan(adminDb(), profile, log);
  scanLog.info("scan_finished", { uid: user.uid, ...stats });
  return jsonOk(stats);
}
