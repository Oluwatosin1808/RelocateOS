import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { getApplication, updateApplication, ApplicationError } from "@/lib/applications/dal";
import { createNotification } from "@/lib/notifications/dal";
import { APPLICATION_STATUS_LABELS } from "@domain/applications/quota";

type Params = Promise<{ id: string }>;

/** GET /api/applications/[id] */
export async function GET(request: Request, { params }: { params: Params }) {
  const correlationId = newCorrelationId();
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  const { id } = await params;
  const application = await getApplication(id);
  if (!application || application.uid !== user.uid) {
    return jsonError(404, "not_found", "Application not found.", correlationId);
  }
  return jsonOk({ application });
}

/** PATCH /api/applications/[id] — update status / notes / outcome. */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.applications.patch", correlationId });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }

  try {
    const before = await getApplication(id);
    const application = await updateApplication(id, user.uid, body as never);
    log.info("application_updated", { uid: user.uid, applicationId: id, status: application.status });

    // Notify on real status changes (never on notes-only updates).
    // Awaited: on serverless, work kicked off after the response can be frozen
    // before it ever runs (observed missing notifications on Vercel).
    if (before && body && typeof body === "object" && "status" in body && before.status !== application.status) {
      try {
        await createNotification(user.uid, {
          kind: "application_update",
          title: `Application moved to "${APPLICATION_STATUS_LABELS[application.status]}"`,
          body: `${application.jobTitle} at ${application.employerName} — status changed from ${APPLICATION_STATUS_LABELS[before.status]} to ${APPLICATION_STATUS_LABELS[application.status]}.`,
          href: "/applications",
          email: user.email ?? undefined,
        });
      } catch (err) {
        log.warn("notification_failed", { error: err instanceof Error ? err.message : String(err) });
      }
    }

    return jsonOk({ application });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return jsonError(err.code === "not_found" ? 404 : 422, err.code, err.message, correlationId);
    }
    if (err instanceof Error && err.name === "ZodError") {
      return jsonError(422, "validation", err.message, correlationId);
    }
    log.error("application_update_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal", "Could not update application.", correlationId);
  }
}
