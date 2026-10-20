import "server-only";
import { z } from "zod";

/**
 * Server-side environment schema.
 *
 * In development (NODE_ENV !== "production") missing Firebase cloud config
 * defaults to the local Emulator Suite so the app runs with zero cloud
 * credentials. In production every required value must be present or the
 * server fails fast with a clear message — never silently degrades to fake
 * behaviour.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1");

const firebaseClientSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_USE_EMULATORS: booleanish.optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  AI_PROVIDER: z.enum(["", "openai-compatible", "local-lexical"]).default(""),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["", "resend", "smtp"]).default(""),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  EMAIL_TEST_RECIPIENT: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  SCHEDULER_SECRET: z.string().optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional(),

  GREENHOUSE_ENABLED: booleanish.optional(),
  LEVER_ENABLED: booleanish.optional(),
  ALLOW_TEST_ADAPTERS: booleanish.optional(),
});

export type ServerEnv = {
  nodeEnv: "development" | "test" | "production";
  appUrl: string;
  useEmulators: boolean;
  firebase: {
    projectId: string;
    clientEmail?: string;
    privateKey?: string;
  };
  ai: {
    provider: "openai-compatible" | "local-lexical" | "none";
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  email: {
    provider: "resend" | "smtp" | "none";
    apiKey?: string;
    fromAddress?: string;
    testRecipient?: string;
    smtp?: { host?: string; port?: number; user?: string; pass?: string };
  };
  schedulerSecret: string | undefined;
  integrationEncryptionKey: string | undefined;
  sources: {
    greenhouseEnabled: boolean;
    leverEnabled: boolean;
  };
  allowTestAdapters: boolean;
};

const DEMO_PROJECT_ID = "relocateos-dev";

function readEnv(): ServerEnv {
  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === "production";

  // Emulator default: ON outside production unless explicitly disabled.
  const useEmulators =
    env.NEXT_PUBLIC_USE_EMULATORS !== undefined
      ? env.NEXT_PUBLIC_USE_EMULATORS
      : !isProd;

  if (useEmulators && isProd) {
    throw new Error(
      "NEXT_PUBLIC_USE_EMULATORS=true is not allowed when NODE_ENV=production.",
    );
  }

  let projectId: string;
  let clientEmail: string | undefined;
  let privateKey: string | undefined;

  if (useEmulators) {
    projectId = env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEMO_PROJECT_ID;
  } else {
    const client = firebaseClientSchema.safeParse(process.env);
    if (!client.success) {
      const missing = client.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(
        `Missing required Firebase client configuration: ${missing}. ` +
          "Set these variables or use NEXT_PUBLIC_USE_EMULATORS=true for local development.",
      );
    }
    projectId =
      env.FIREBASE_PROJECT_ID || client.data.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    clientEmail = env.FIREBASE_CLIENT_EMAIL;
    privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error(
          "Missing Firebase Admin credentials. Provide FIREBASE_CLIENT_EMAIL and " +
            "FIREBASE_PRIVATE_KEY, or set GOOGLE_APPLICATION_CREDENTIALS to a " +
            "service-account file, when NEXT_PUBLIC_USE_EMULATORS=false.",
        );
      }
    }
  }

  if (isProd) {
    if (!env.SCHEDULER_SECRET) {
      throw new Error("SCHEDULER_SECRET is required in production.");
    }
    if (env.ALLOW_TEST_ADAPTERS) {
      throw new Error("ALLOW_TEST_ADAPTERS must be false in production.");
    }
  }

  const aiProvider =
    env.AI_PROVIDER === "openai-compatible"
      ? env.AI_API_KEY
        ? "openai-compatible"
        : "none"
      : env.AI_PROVIDER === "local-lexical"
        ? "local-lexical"
        : "none";

  const emailProvider =
    env.EMAIL_PROVIDER === "resend" && env.EMAIL_API_KEY
      ? "resend"
      : env.EMAIL_PROVIDER === "smtp" && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
        ? "smtp"
        : "none";

  return {
    nodeEnv: env.NODE_ENV,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    useEmulators,
    firebase: {
      projectId,
      clientEmail,
      privateKey,
    },
    ai: {
      provider: aiProvider,
      apiKey: env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
    },
    email: {
      provider: emailProvider,
      apiKey: env.EMAIL_API_KEY,
      fromAddress: env.EMAIL_FROM_ADDRESS,
      testRecipient: env.EMAIL_TEST_RECIPIENT,
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    },
    schedulerSecret: env.SCHEDULER_SECRET,
    integrationEncryptionKey: env.INTEGRATION_ENCRYPTION_KEY,
    sources: {
      greenhouseEnabled: env.GREENHOUSE_ENABLED ?? true,
      leverEnabled: env.LEVER_ENABLED ?? true,
    },
    allowTestAdapters: env.ALLOW_TEST_ADAPTERS ?? false,
  };
}

declare global {
  var __relocateosEnv: ServerEnv | undefined;
}

export function getServerEnv(): ServerEnv {
  if (!globalThis.__relocateosEnv) {
    globalThis.__relocateosEnv = readEnv();
  }
  return globalThis.__relocateosEnv;
}

/** Human-readable capability report for health checks and the Automation page. */
export function describeServerCapabilities(env: ServerEnv): {
  ai: { configured: boolean; provider: string; note?: string };
  email: { configured: boolean; provider: string; note?: string };
  sources: { greenhouse: boolean; lever: boolean; testAdapters: boolean };
} {
  return {
    ai: {
      configured: env.ai.provider !== "none",
      provider: env.ai.provider,
      note:
        env.ai.provider === "none"
          ? "No AI API key configured. Deterministic rule-based analysis will be used and labelled as such."
          : undefined,
    },
    email: {
      configured: env.email.provider !== "none",
      provider: env.email.provider,
      note:
        env.email.provider === "none"
          ? "No email provider configured. Notifications will be stored but not delivered."
          : undefined,
    },
    sources: {
      greenhouse: env.sources.greenhouseEnabled,
      lever: env.sources.leverEnabled,
      testAdapters: env.allowTestAdapters,
    },
  };
}
