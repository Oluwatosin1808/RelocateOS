import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { getJob } from "@/lib/jobs/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { analyzeJob } from "@/lib/ai/analyze";
import { getServerEnv } from "@/lib/configuration/env";

type Params = Promise<{ id: string }>;

/**
 * POST /api/scout/jobs/[id]/ai-analysis — AI-assisted match analysis.
 * Returns `{ available: false }` when no AI provider is configured — the UI
 * falls back to the deterministic score. Never fabricates analysis.
 */
export async function POST(_request: Request, { params }: { params: Params }) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.scout.ai-analysis", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }

  const { id } = await params;
  const [job, profile] = await Promise.all([getJob(id), loadCandidateProfile(user.uid)]);
  if (!job) {
    return jsonError(404, "not_found", "Job not found.", correlationId);
  }
  if (!profile) {
    return jsonError(409, "no_profile", "Complete onboarding first.", correlationId);
  }

  const env = getServerEnv();
  if (env.ai.provider !== "openai-compatible") {
    return jsonOk({
      available: false,
      reason:
        "AI provider is not configured. Set AI_PROVIDER=openai-compatible and AI_API_KEY in .env.local to enable AI analysis.",
    });
  }

  const result = await analyzeJob(job, profile);
  log.info("ai_analysis_done", {
    uid: user.uid,
    jobId: id,
    available: result.available,
  });
  return jsonOk(result);
}
