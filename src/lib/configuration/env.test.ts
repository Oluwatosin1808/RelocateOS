import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv, describeServerCapabilities } from "@/lib/configuration/env";

function setEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  const original = { ...process.env };
  process.env = { ...original, ...overrides };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
  }
  delete (globalThis as { __relocateosEnv?: unknown }).__relocateosEnv;
  return () => {
    process.env = original;
    delete (globalThis as { __relocateosEnv?: unknown }).__relocateosEnv;
    vi.resetModules();
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getServerEnv (development)", () => {
  it("defaults to emulator mode with a demo project id", () => {
    const restore = setEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined,
    });
    try {
      const env = getServerEnv();
      expect(env.useEmulators).toBe(true);
      expect(env.firebase.projectId).toBe("relocateos-dev");
      expect(env.ai.provider).toBe("none");
      expect(env.email.provider).toBe("none");
      expect(env.allowTestAdapters).toBe(false);
    } finally {
      restore();
    }
  });

  it("marks AI as unconfigured without an API key", () => {
    const restore = setEnv({
      NODE_ENV: "development",
      AI_PROVIDER: "openai-compatible",
      AI_API_KEY: undefined,
    });
    try {
      const env = getServerEnv();
      expect(env.ai.provider).toBe("none");
    } finally {
      restore();
    }
  });

  it("enables openai-compatible AI when provider and key are set", () => {
    const restore = setEnv({
      NODE_ENV: "development",
      AI_PROVIDER: "openai-compatible",
      AI_API_KEY: "test-key",
      AI_MODEL: "gpt-test",
    });
    try {
      const env = getServerEnv();
      expect(env.ai.provider).toBe("openai-compatible");
      expect(env.ai.model).toBe("gpt-test");
    } finally {
      restore();
    }
  });
});

describe("getServerEnv (production)", () => {
  it("requires Firebase client configuration when emulators are off", () => {
    const restore = setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_USE_EMULATORS: "false",
      NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
      SCHEDULER_SECRET: "sched-secret",
    });
    try {
      expect(() => getServerEnv()).toThrow(/Missing required Firebase client configuration/);
    } finally {
      restore();
    }
  });

  it("rejects emulator mode in production", () => {
    const restore = setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_USE_EMULATORS: "true",
      SCHEDULER_SECRET: "sched-secret",
    });
    try {
      expect(() => getServerEnv()).toThrow(/not allowed/);
    } finally {
      restore();
    }
  });

  it("rejects ALLOW_TEST_ADAPTERS in production", () => {
    const restore = setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_USE_EMULATORS: "false",
      NEXT_PUBLIC_FIREBASE_API_KEY: "k",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "x.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "p.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1",
      NEXT_PUBLIC_FIREBASE_APP_ID: "a",
      FIREBASE_CLIENT_EMAIL: "sdk@p.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "key",
      SCHEDULER_SECRET: "sched-secret",
      ALLOW_TEST_ADAPTERS: "true",
    });
    try {
      expect(() => getServerEnv()).toThrow(/ALLOW_TEST_ADAPTERS/);
    } finally {
      restore();
    }
  });

  it("requires SCHEDULER_SECRET in production", () => {
    const restore = setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_USE_EMULATORS: "false",
      NEXT_PUBLIC_FIREBASE_API_KEY: "k",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "x.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "p.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1",
      NEXT_PUBLIC_FIREBASE_APP_ID: "a",
      FIREBASE_CLIENT_EMAIL: "sdk@p.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "key",
      SCHEDULER_SECRET: undefined,
    });
    try {
      expect(() => getServerEnv()).toThrow(/SCHEDULER_SECRET/);
    } finally {
      restore();
    }
  });
});

describe("describeServerCapabilities", () => {
  it("explains missing providers", () => {
    const restore = setEnv({ NODE_ENV: "development" });
    try {
      const caps = describeServerCapabilities(getServerEnv());
      expect(caps.ai.configured).toBe(false);
      expect(caps.ai.note).toMatch(/rule-based/);
      expect(caps.email.configured).toBe(false);
      expect(caps.email.note).toMatch(/not delivered/);
    } finally {
      restore();
    }
  });
});
