import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";

export async function POST() {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.onboarding.complete", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const now = new Date().toISOString();
  await adminDb().doc(`users/${user.uid}`).set(
    { onboardingCompleted: true, updatedAt: now },
    { merge: true },
  );
  log.info("onboarding_completed", { uid: user.uid });
  return jsonOk({ ok: true as const });
}
