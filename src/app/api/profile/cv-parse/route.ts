import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { adminDb } from "@/lib/firebase/admin";
import { connection } from "next/server";
import { parseCvProfile } from "@/lib/ai/parse-cv";

const MAX_TEXT = 120_000;

/**
 * POST /api/profile/cv-parse — extract a structured profile draft from CV text.
 * Body: { text, cvFileId? } — when cvFileId is given the FULL extracted text is
 * loaded server-side from the CV store (the request text is only a fallback).
 * Returns the draft plus the honest extraction source (ai | deterministic).
 */
export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.profile.cv-parse", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }

  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    cvFileId?: unknown;
  } | null;
  if (!body || typeof body.text !== "string" || body.text.trim().length === 0) {
    return jsonError(400, "missing_text", "Provide extracted CV `text`.", correlationId);
  }
  let text = body.text.slice(0, MAX_TEXT);

  // Prefer the full stored extraction for this upload.
  const cvFileId = typeof body.cvFileId === "string" ? body.cvFileId : "";
  if (cvFileId && /^[a-z0-9_\-]+$/i.test(cvFileId)) {
    try {
      await connection();
      const meta = await adminDb().doc(`cvOriginals/${user.uid}__${cvFileId}`).get();
      const stored = meta.data()?.extractedText;
      if (typeof stored === "string" && stored.length > text.length) {
        text = stored.slice(0, MAX_TEXT);
      }
    } catch {
      /* fall back to request text */
    }
  }

  const parsed = await parseCvProfile(text);
  log.info("cv_profile_parsed", {
    uid: user.uid,
    source: parsed.source,
    textChars: parsed.textChars,
    experiences: parsed.draft.workExperience.length,
    skills: parsed.draft.skills.length,
  });

  return jsonOk({
    source: parsed.source,
    aiReason: parsed.aiReason,
    model: parsed.model,
    textChars: parsed.textChars,
    draft: parsed.draft,
  });
}
