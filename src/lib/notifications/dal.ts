import "server-only";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  notificationSchema,
  notificationPreferencesSchema,
  type Notification,
  type NotificationKind,
  type NotificationPreferences,
} from "@domain/schemas/notification";
import { getServerEnv } from "@/lib/configuration/env";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger({ module: "notifications.dal" });

export async function listNotifications(
  uid: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  await connection();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  let query: FirebaseFirestore.Query = adminDb()
    .collection("notifications")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit);
  if (opts.unreadOnly) {
    query = adminDb()
      .collection("notifications")
      .where("uid", "==", uid)
      .where("read", "==", false)
      .orderBy("createdAt", "desc")
      .limit(limit);
  }
  const snap = await query.get();
  const items: Notification[] = [];
  for (const d of snap.docs) {
    const parsed = notificationSchema.safeParse({ id: d.id, ...d.data() });
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

/**
 * Persist a notification, then attempt email delivery when the user has
 * email enabled for this kind. Delivery is honest: if no email provider is
 * configured, the notification is stored with deliveryStatus="provider_unconfigured"
 * and NOT silently dropped. Respects per-kind notification preferences.
 */
export async function createNotification(
  uid: string,
  input: {
    kind: NotificationKind;
    title: string;
    body: string;
    href?: string;
    email?: string;
  },
): Promise<Notification> {
  const now = new Date().toISOString();
  const env = getServerEnv();

  // Check user preferences before attempting email.
  const prefs = await getNotificationPreferences(uid);
  const kindAllowed =
    input.kind === "scan_complete" ? prefs.scanSummaries
    : input.kind === "new_match" ? prefs.newMatchAlerts
    : input.kind === "application_update" ? prefs.applicationUpdates
    : input.kind === "quota_reached" ? prefs.applicationUpdates
    : true;
  const emailAllowed = prefs.emailEnabled && kindAllowed;

  let deliveryStatus: Notification["deliveryStatus"] = "stored";
  let providerMessageId = "";

  if (env.email.provider !== "none" && input.email && emailAllowed) {
    // Resend test keys only deliver to the sandbox address (onboarding@resend.dev).
    // When EMAIL_TEST_RECIPIENT is set, redirect all outgoing email there for testing.
    const recipient = env.email.testRecipient ?? input.email;
    const from =
      env.email.fromAddress ??
      (env.email.provider === "smtp"
        ? `RelocateOS <${env.email.smtp?.user ?? ""}>`
        : "RelocateOS <onboarding@resend.dev>");
    try {
      if (env.email.provider === "smtp") {
        const { sendSmtpEmail } = await import("@/lib/email/smtp");
        const info = await sendSmtpEmail(env, {
          to: recipient,
          from,
          subject: input.title,
          text: input.body,
        });
        deliveryStatus = "sent";
        providerMessageId = info.messageId;
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.email.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [recipient],
            subject: input.title,
            text: input.body,
          }),
        });
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as { id?: string } | null;
          deliveryStatus = "sent";
          providerMessageId = body?.id ?? "";
        } else {
          const errBody = await res.text().catch(() => "");
          deliveryStatus = "failed";
          log.warn("email_delivery_failed", { status: res.status, error: errBody.slice(0, 300) });
        }
      }
    } catch (err) {
      deliveryStatus = "failed";
      log.warn("email_delivery_error", {
        provider: env.email.provider,
        error: err instanceof Error ? err.message.slice(0, 300) : "unknown",
      });
    }
  } else if (env.email.provider === "none") {
    deliveryStatus = "provider_unconfigured";
  }

  const doc = {
    uid,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href ?? "",
    deliveryStatus,
    providerMessageId,
    read: false,
    createdAt: now,
  };
  const ref = await adminDb().collection("notifications").add(doc);
  return { id: ref.id, ...doc };
}

export async function markNotificationRead(id: string, uid: string): Promise<void> {
  const snap = await adminDb().doc(`notifications/${id}`).get();
  if (!snap.exists) return;
  if (snap.data()?.uid !== uid) return;
  await adminDb().doc(`notifications/${id}`).set({ read: true }, { merge: true });
}

export async function markAllNotificationsRead(uid: string): Promise<number> {
  const snap = await adminDb()
    .collection("notifications")
    .where("uid", "==", uid)
    .where("read", "==", false)
    .limit(100)
    .get();
  if (snap.empty) return 0;
  const batch = adminDb().batch();
  for (const d of snap.docs) {
    batch.set(d.ref, { read: true }, { merge: true });
  }
  await batch.commit();
  return snap.size;
}

export async function getNotificationPreferences(uid: string): Promise<NotificationPreferences> {
  await connection();
  const snap = await adminDb().doc(`users/${uid}`).get();
  const raw = snap.data()?.notificationPreferences;
  const parsed = notificationPreferencesSchema.safeParse(raw);
  return parsed.success ? parsed.data : notificationPreferencesSchema.parse({});
}

export async function saveNotificationPreferences(
  uid: string,
  input: unknown,
): Promise<NotificationPreferences> {
  const parsed = notificationPreferencesSchema.parse(input);
  await adminDb()
    .doc(`users/${uid}`)
    .set({ notificationPreferences: parsed }, { merge: true });
  return parsed;
}
