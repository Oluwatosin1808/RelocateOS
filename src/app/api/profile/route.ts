import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import {
  loadCandidateProfile,
  saveCandidateProfile,
  emptyCandidateProfile,
  ProfileValidationError,
} from "@/lib/profile/dal";
import { computeProfileCompleteness } from "@domain/schemas/candidate-profile";

export async function GET() {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.profile.get", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const profile = await loadCandidateProfile(user.uid);
  const now = new Date().toISOString();
  const resolved = profile ?? emptyCandidateProfile(now);
  const completeness = computeProfileCompleteness(resolved);
  log.info("profile_fetched", { uid: user.uid, hasProfile: profile !== null });
  return jsonOk({ profile: resolved, completeness });
}

export async function PUT(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.profile.put", correlationId });
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
  const input =
    typeof body === "object" && body !== null && "profile" in body
      ? (body as { profile: unknown }).profile
      : body;
  try {
    const saved = await saveCandidateProfile(user.uid, input);
    const completeness = computeProfileCompleteness(saved);
    log.info("profile_saved", { uid: user.uid });
    return jsonOk({ profile: saved, completeness });
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return jsonError(422, "validation", err.message, correlationId);
    }
    log.error("profile_save_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal", "Could not save profile.", correlationId);
  }
}
