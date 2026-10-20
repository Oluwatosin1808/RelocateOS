import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { setJobsStatus } from "@/lib/jobs/dal";
import { jobStatusSchema } from "@domain/schemas/job";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(100),
  status: jobStatusSchema,
});

/** Bulk status update for Scout shortlist/archive workflows. */
export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.scout.jobs.bulk", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(
      422,
      "validation",
      issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid bulk request",
      correlationId,
    );
  }
  const { ids, status } = parsed.data;
  const count = await setJobsStatus(ids, status);
  log.info("jobs_bulk_status", { uid: user.uid, count, status });
  return jsonOk({ ok: true as const, updated: count, status });
}
