import "server-only";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  candidateProfileSchema,
  type CandidateProfile,
} from "@domain/schemas/candidate-profile";
import { getSessionUser } from "@/lib/auth/session";
import { suggestedGreenhouseBoards } from "@fn/integrations/registry";

export const PROFILE_DOC = "candidateProfiles";

export function profilePath(uid: string): string {
  return `${PROFILE_DOC}/${uid}`;
}

/** Server-side load of the candidate profile. Returns null when absent. */
export async function loadCandidateProfile(uid: string): Promise<CandidateProfile | null> {
  // Firestore Admin SDK uses crypto.randomBytes internally, which is unstable
  // for prerendering under cacheComponents — mark this read as request-time.
  await connection();
  const snap = await adminDb().doc(profilePath(uid)).get();
  if (!snap.exists) return null;
  const parsed = candidateProfileSchema.safeParse(snap.data());
  return parsed.success ? parsed.data : null;
}

/** Empty profile skeleton used before the user has saved anything. */
export function emptyCandidateProfile(nowIso: string): CandidateProfile {
  return candidateProfileSchema.parse({ updatedAt: nowIso, createdAt: nowIso });
}

/**
 * Persist a candidate profile. Input is validated with the shared Zod schema
 * so both the API and any future server action share one contract.
 */
export async function saveCandidateProfile(
  uid: string,
  input: unknown,
): Promise<CandidateProfile> {
  const now = new Date().toISOString();
  const existing = await loadCandidateProfile(uid);
  const base = existing ?? emptyCandidateProfile(now);
  const parsed = candidateProfileSchema.safeParse({
    ...base,
    ...(typeof input === "object" && input !== null ? input : {}),
    updatedAt: now,
    createdAt: base.createdAt,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ProfileValidationError(
      first ? `${first.path.join(".") || "profile"}: ${first.message}` : "Invalid profile",
      parsed.error.issues.map((issue) => ({
        path: issue.path as (string | number)[],
        message: issue.message,
      })),
    );
  }
  await adminDb()
    .doc(profilePath(uid))
    .set({ ...parsed.data }, { merge: false });
  return parsed.data;
}

export class ProfileValidationError extends Error {
  constructor(
    message: string,
    readonly issues: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

/** Requires a signed-in session; used by API routes. */
export async function requireProfileUid(): Promise<string | null> {
  const user = await getSessionUser();
  return user ? user.uid : null;
}

/** Default job sources offered during onboarding (never fabricated as healthy). */
export function defaultJobSources(): {
  provider: "greenhouse";
  boardToken: string;
  displayName: string;
  note: string;
}[] {
  return suggestedGreenhouseBoards().map((b) => ({
    provider: "greenhouse" as const,
    boardToken: b.boardToken,
    displayName: b.displayName,
    note: b.note,
  }));
}
