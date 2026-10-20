import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { jobSourceSchema } from "@domain/schemas/job";
import { buildAdapterForSource } from "@fn/integrations/registry";

type Params = { params: Promise<{ id: string }> };

/**
 * Live health check for a configured source. Health is never assumed:
 * a 404 from Greenhouse is reported as a failure with the real message.
 */
export async function POST(_request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.sources.health", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  const snap = await adminDb().doc(`jobSources/${id}`).get();
  if (!snap.exists) {
    return jsonError(404, "not_found", "Source not found.", correlationId);
  }
  const parsed = jobSourceSchema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) {
    return jsonError(500, "invalid_doc", "Stored source failed validation.", correlationId);
  }
  const source = parsed.data;
  const adapter = buildAdapterForSource(source);
  if (!adapter) {
    const reason = "No adapter could be constructed — check the source configuration.";
    await adminDb()
      .doc(`jobSources/${id}`)
      .set(
        { healthStatus: "unconfigured", lastFailureReason: reason, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    return jsonOk({
      sourceId: id,
      healthStatus: "unconfigured" as const,
      ok: false,
      message: reason,
      checkedAt: new Date().toISOString(),
    });
  }
  const result = await adapter.health();
  const now = new Date().toISOString();
  const healthStatus = result.ok ? ("healthy" as const) : ("failing" as const);
  await adminDb().doc(`jobSources/${id}`).set(
    {
      healthStatus,
      lastFailureAt: result.ok ? null : now,
      lastFailureReason: result.ok ? "" : result.message,
      ...(result.ok ? { lastSuccessfulSyncAt: now } : {}),
      updatedAt: now,
    },
    { merge: true },
  );
  log.info("source_health_checked", { sourceId: id, ok: result.ok });
  return jsonOk({
    sourceId: id,
    healthStatus,
    ok: result.ok,
    message: result.message,
    details: result.details ?? null,
    checkedAt: result.checkedAt,
  });
}
