import { chromium, type BrowserContext } from "@playwright/test";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "phase2-346680081@example.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "TestPassw0rd!";

function loadFirebaseApiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const m = raw.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
    if (m?.[1]) return m[1].trim();
  } catch {
    /* fall through */
  }
  return "";
}
const FIREBASE_API_KEY = loadFirebaseApiKey();
const SERVICE_ACCOUNT_PATH = "C:/Users/DELL/Documents/RelocateOS/secrets/service-account.json";

let adminApp: ReturnType<typeof initializeApp> | null = null;

function getAdminAuth() {
  if (!adminApp) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sa = require(SERVICE_ACCOUNT_PATH);
    adminApp = initializeApp({ credential: cert(sa), projectId: "relocateos" }, "e2e");
  }
  return getAuth(adminApp);
}

/**
 * Exchange email/password for an ID token via the Firebase Auth REST API.
 * Returns the ID token used to establish the app session cookie.
 */
export async function getIdToken(email = TEST_EMAIL, password = TEST_PASSWORD): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) {
    throw new Error(`Firebase auth failed: ${data.error?.message ?? "unknown"}`);
  }
  return data.idToken;
}

/**
 * Authenticate a Playwright browser context: mint an ID token, exchange it for
 * the app's session cookie, and set the cookie in the context so subsequent
 * page navigations are authenticated.
 */
export async function authenticate(context: BrowserContext): Promise<void> {
  const idToken = await getIdToken();
  const res = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new Error(`Session exchange failed: ${res.status} ${await res.text()}`);
  }
  const cookies = res.headers.getSetCookie();
  for (const c of cookies) {
    const pair = c.split(";")[0] ?? "";
    const eqIdx = pair.indexOf("=");
    if (eqIdx <= 0) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    await context.addCookies([
      {
        name,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }
}

export { TEST_EMAIL, TEST_PASSWORD, BASE_URL };
