import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { getJob, setJobStatus } from "@/lib/jobs/dal";
import { jobStatusSchema } from "@domain/schemas/job";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ status: jobStatusSchema });

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.scout.jobs.patch", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return jsonError(404, "not_found", "Job not found.", correlationId);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, "validation", "Invalid status value.", correlationId);
  }
  await setJobStatus(id, parsed.data.status);
  log.info("job_status_updated", { uid: user.uid, jobId: id, status: parsed.data.status });
  return jsonOk({ ok: true as const, status: parsed.data.status });
}
