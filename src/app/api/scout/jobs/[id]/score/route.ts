import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { scoreAndPersistJob, getJobScore } from "@/lib/jobs/scoring-dal";
import { getJob } from "@/lib/jobs/dal";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  const score = await getJobScore(id);
  if (!score) {
    return jsonError(404, "not_scored", "Job has not been scored yet.", correlationId);
  }
  return jsonOk({ score });
}

export async function POST(_request: Request, { params }: Params) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.scout.score", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return jsonError(404, "not_found", "Job not found.", correlationId);
  }
  const result = await scoreAndPersistJob(user.uid, id);
  if (!result) {
    return jsonError(
      409,
      "no_profile",
      "Save your candidate profile before scoring jobs.",
      correlationId,
    );
  }
  log.info("job_scored", { uid: user.uid, jobId: id, total: result.score.total });
  return jsonOk({ score: result.score, doc: result.doc });
}
