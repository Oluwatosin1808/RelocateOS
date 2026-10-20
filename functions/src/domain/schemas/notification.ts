import { z } from "zod";

/**
 * Notification record — persisted first, delivered second.
 *
 * HONESTY RULES:
 * - `deliveryStatus` is always set honestly: "provider_unconfigured" when no
 *   email key is present, "sent" only after a real provider response,
 *   "failed" on provider error, "stored" when no delivery was attempted.
 * - No notification is ever silently dropped.
 */

export const notificationKindSchema = z.enum([
  "scan_complete",
  "new_match",
  "application_update",
  "quota_reached",
  "relocation_milestone",
  "system",
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const deliveryStatusSchema = z.enum([
  "stored",
  "provider_unconfigured",
  "sent",
  "failed",
]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const notificationSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  kind: notificationKindSchema,
  title: z.string().max(200),
  body: z.string().max(2000),
  /** Optional deep-link path within the app. */
  href: z.string().max(300).default(""),
  deliveryStatus: deliveryStatusSchema.default("stored"),
  /** Email provider message id when sent. */
  providerMessageId: z.string().max(200).default(""),
  read: z.boolean().default(false),
  createdAt: z.iso.datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().default(true),
  scanSummaries: z.boolean().default(true),
  newMatchAlerts: z.boolean().default(true),
  applicationUpdates: z.boolean().default(true),
  weeklyDigest: z.boolean().default(false),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
