import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { userDocSchema, type UserDoc } from "@domain/schemas/user";

/**
 * Data Access Layer. Every private page/action goes through these helpers.
 * `use cache: private` keeps the session read in the browser cache only and
 * gives it a lifetime so authenticated navigations stay instant.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  "use cache: private";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getCurrentUserDoc(): Promise<{ user: SessionUser; doc: UserDoc }> {
  "use cache: private";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const snap = await adminDb().doc(`users/${user.uid}`).get();
  if (!snap.exists) {
    redirect("/login");
  }
  const parsed = userDocSchema.safeParse(snap.data());
  if (!parsed.success) {
    redirect("/login");
  }
  return { user, doc: parsed.data };
}

/** For layouts: redirect to onboarding when the profile is not set up yet. */
export async function requireOnboardedUser(): Promise<{
  user: SessionUser;
  doc: UserDoc;
}> {
  const result = await getCurrentUserDoc();
  if (!result.doc.onboardingCompleted) {
    redirect("/onboarding");
  }
  return result;
}
