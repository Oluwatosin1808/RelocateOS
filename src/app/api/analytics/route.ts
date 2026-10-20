import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getAnalyticsSnapshot } from "@/lib/analytics/dal";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";

/** GET /api/analytics — aggregated pipeline metrics for the dashboard. */
export async function GET() {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.analytics.get", correlationId });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  const snapshot = await getAnalyticsSnapshot(user.uid);
  log.info("analytics_computed", { uid: user.uid, applied: snapshot.pipeline.applied });
  return jsonOk(snapshot);
}
