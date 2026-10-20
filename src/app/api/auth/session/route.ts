import { z } from "zod";
import {
  createSessionCookieFromIdToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { userDocSchema } from "@domain/schemas/user";

const bodySchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.auth.session", correlationId });

  const parse = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parse.success) {
    return jsonError(400, "invalid_body", "Missing or invalid idToken.", correlationId);
  }

  const cookieValue = await createSessionCookieFromIdToken(parse.data.idToken);
  if (!cookieValue) {
    return jsonError(401, "invalid_token", "Could not verify the supplied ID token.", correlationId);
  }

  try {
    const decoded = await adminAuth().verifyIdToken(parse.data.idToken);
    const ref = adminDb().doc(`users/${decoded.uid}`);
    const existing = await ref.get();
    if (!existing.exists) {
      const now = new Date().toISOString();
      const doc = userDocSchema.parse({
        email: decoded.email ?? "",
        displayName: decoded.name ?? "",
        timezone: "Europe/Amsterdam",
        onboardingCompleted: false,
        automationEnabled: false,
        createdAt: now,
        updatedAt: now,
      });
      await ref.create(doc);
      log.info("user_doc_created", { uid: decoded.uid });
    }
  } catch (err) {
    log.error("user_bootstrap_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "bootstrap_failed", "Could not prepare the user account.", correlationId);
  }

  const response = jsonOk({ ok: true as const });
  response.cookies.set(SESSION_COOKIE, cookieValue, sessionCookieOptions);
  log.info("session_established");
  return response;
}
