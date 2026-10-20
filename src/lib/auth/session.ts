import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { createLogger } from "@/lib/logging/logger";

export const SESSION_COOKIE = "relocateos_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const log = createLogger({ module: "auth.session" });

export type SessionUser = {
  uid: string;
  email: string | null;
};

/**
 * Create an HTTP-only Firebase session cookie from a verified ID token.
 * Returns null when the ID token is invalid.
 */
export async function createSessionCookieFromIdToken(idToken: string): Promise<string | null> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const cookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_TTL_MS,
    });
    log.info("session_cookie_created", { uid: decoded.uid });
    return cookie;
  } catch (err) {
    log.warn("session_cookie_create_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Verify the session cookie and return the authenticated user, or null.
 * This is the single server-side gate for every private route and action.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (err) {
    log.warn("session_verify_failed", {
      error: err instanceof Error ? err.message : String(err),
      code: err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : undefined,
      emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? null,
    });
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
