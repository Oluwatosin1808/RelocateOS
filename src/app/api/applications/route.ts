import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { listApplications, createApplication, ApplicationError } from "@/lib/applications/dal";
import { countTodaySubmissions } from "@/lib/applications/dal";
import { checkQuota } from "@domain/applications/quota";
import { loadCandidateProfile } from "@/lib/profile/dal";
import type { ApplicationStatus } from "@domain/schemas/application";

/** GET /api/applications — list the user's applications, optional status filter. */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.applications.get", correlationId });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && statusParam !== "all" ? (statusParam as ApplicationStatus) : null;

  const [applications, usedToday, profile] = await Promise.all([
    listApplications(user.uid, { status }),
    countTodaySubmissions(user.uid),
    loadCandidateProfile(user.uid),
  ]);
  const limit = profile?.automationPreferences.maxAutoSubmissionsPerDay ?? 10;
  const quota = checkQuota(usedToday, limit);

  log.info("applications_listed", { uid: user.uid, count: applications.length });
  return jsonOk({ applications, quota });
}

/** POST /api/applications — create an application record. */
export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.applications.post", correlationId });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }

  try {
    const application = await createApplication(user.uid, body as never);
    log.info("application_created", {
      uid: user.uid,
      applicationId: application.id,
      jobId: application.jobId,
      status: application.status,
    });
    return jsonOk({ application }, { status: 201 });
  } catch (err) {
    if (err instanceof ApplicationError) {
      return jsonError(422, err.code, err.message, correlationId);
    }
    if (err instanceof Error && err.name === "ZodError") {
      return jsonError(422, "validation", err.message, correlationId);
    }
    log.error("application_create_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal", "Could not create application.", correlationId);
  }
}
