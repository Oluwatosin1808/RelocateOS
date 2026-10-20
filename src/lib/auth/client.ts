"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

async function establishSession(): Promise<void> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Not signed in with Firebase.");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(body?.error?.message ?? "Could not start your session.");
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getClientAuth(), email, password);
  await establishSession();
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(getClientAuth(), email, password);
  await establishSession();
}

export async function signOutUser(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  await signOut(getClientAuth());
}
