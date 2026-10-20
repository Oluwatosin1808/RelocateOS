"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS !== "false";

const firebaseConfig = useEmulators
  ? {
      apiKey: "demo-api-key",
      authDomain: "localhost",
      projectId: "relocateos-dev",
      storageBucket: "relocateos-dev.appspot.com",
      messagingSenderId: "0",
      appId: "demo-app-id",
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

let app: FirebaseApp | null = null;
let emulatorsConnected = false;

function connectEmulators(auth: Auth, store: Firestore, storage: FirebaseStorage): void {
  if (emulatorsConnected) return;
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "http://127.0.0.1:9099";
  const [fsHost, fsPortRaw] = (
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
  ).split(":");
  const [storageHost, storagePortRaw] = (
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199"
  ).split(":");
  connectAuthEmulator(auth, authHost, { disableWarnings: true });
  connectFirestoreEmulator(store, fsHost ?? "127.0.0.1", Number(fsPortRaw ?? 8080));
  connectStorageEmulator(storage, storageHost ?? "127.0.0.1", Number(storagePortRaw ?? 9199));
  emulatorsConnected = true;
}

function createClientApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  const created = initializeApp(firebaseConfig);
  if (useEmulators) {
    connectEmulators(getAuth(created), getFirestore(created), getStorage(created));
  }
  return created;
}

export function getClientApp(): FirebaseApp {
  if (!app) app = createClientApp();
  return app;
}

export function getClientAuth(): Auth {
  return getAuth(getClientApp());
}

export function getClientFirestore(): Firestore {
  return getFirestore(getClientApp());
}

export function getClientStorage(): FirebaseStorage {
  return getStorage(getClientApp());
}

export { useEmulators as clientUsesEmulators };
