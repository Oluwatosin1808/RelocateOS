import "server-only";
import { cert, getApps, initializeApp, type App, type AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getServerEnv } from "@/lib/configuration/env";

let app: App | null = null;

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const env = getServerEnv();
  const options: AppOptions = {
    projectId: env.firebase.projectId,
    storageBucket: `${env.firebase.projectId}.firebasestorage.app`,
  };

  if (env.useEmulators) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
  } else if (env.firebase.clientEmail && env.firebase.privateKey) {
    options.credential = cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    });
  }

  return initializeApp(options);
}

export function getAdminApp(): App {
  if (!app) app = createAdminApp();
  return app;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminStorage() {
  return getStorage(getAdminApp());
}
