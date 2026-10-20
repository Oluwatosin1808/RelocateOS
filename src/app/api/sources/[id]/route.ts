import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { jobSourceSchema } from "@domain/schemas/job";
import { sourceUpdateSchema } from "@/lib/sources/schema";
import { buildAdapterForSource } from "@fn/integrations/registry";

type Params = { params: Promise<{ id: string }> };
const COLLECTION = "jobSources";

export async function GET(_request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  const snap = await adminDb().doc(`${COLLECTION}/${id}`).get();
  if (!snap.exists) {
    return jsonError(404, "not_found", "Source not found.", correlationId);
  }
  const parsed = jobSourceSchema.safeParse({ id: snap.id, ...snap.data() });
  if (!parsed.success) {
    return jsonError(500, "invalid_doc", "Stored source failed validation.", correlationId);
  }
  return jsonOk({ source: parsed.data });
}

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.sources.patch", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }
  const parsed = sourceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(
      422,
      "validation",
      issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid update",
      correlationId,
    );
  }
  const ref = adminDb().doc(`${COLLECTION}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return jsonError(404, "not_found", "Source not found.", correlationId);
  }
  const current = jobSourceSchema.safeParse({ id, ...snap.data() });
  if (!current.success) {
    return jsonError(500, "invalid_doc", "Stored source failed validation.", correlationId);
  }
  const mergedConfig = {
    ...current.data.configuration,
    ...(parsed.data.configuration ?? {}),
  };
  // If config changed, re-check adapter can still be constructed.
  if (parsed.data.configuration) {
    const probe = buildAdapterForSource({
      ...current.data,
      configuration: mergedConfig,
    });
    if (!probe) {
      return jsonError(
        422,
        "incomplete_config",
        "Updated configuration is incomplete for this provider.",
        correlationId,
      );
    }
  }
  const now = new Date().toISOString();
  await ref.set(
    {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.configuration !== undefined ? { configuration: mergedConfig } : {}),
      updatedAt: now,
    },
    { merge: true },
  );
  const updated = jobSourceSchema.safeParse({
    ...current.data,
    id,
    ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
    ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    ...(parsed.data.configuration !== undefined ? { configuration: mergedConfig } : {}),
    updatedAt: now,
  });
  log.info("source_updated", { uid: user.uid, sourceId: id });
  if (!updated.success) {
    return jsonError(500, "internal", "Updated source failed validation.", correlationId);
  }
  return jsonOk({ source: updated.data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.sources.delete", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  const ref = adminDb().doc(`${COLLECTION}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return jsonError(404, "not_found", "Source not found.", correlationId);
  }
  await ref.delete();
  log.info("source_deleted", { uid: user.uid, sourceId: id });
  return jsonOk({ ok: true as const });
}
