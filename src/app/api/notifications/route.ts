import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notifications/dal";

/** GET /api/notifications — list recent notifications. */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const notifications = await listNotifications(user.uid, { unreadOnly });
  return jsonOk({ notifications });
}

/** PATCH /api/notifications — bulk mark read, or update preferences. */
export async function PATCH(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.notifications.patch", correlationId });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be JSON.", correlationId);
  }

  const b = body as { action?: string; id?: string; preferences?: unknown };
  if (b.action === "mark_all_read") {
    const count = await markAllNotificationsRead(user.uid);
    log.info("notifications_marked_read", { uid: user.uid, count });
    return jsonOk({ ok: true, updated: count });
  }
  if (b.action === "mark_read" && b.id) {
    await markNotificationRead(b.id, user.uid);
    return jsonOk({ ok: true });
  }
  if (b.preferences !== undefined) {
    const prefs = await saveNotificationPreferences(user.uid, b.preferences);
    return jsonOk({ preferences: prefs });
  }
  return jsonError(400, "invalid_action", "Unknown action.", correlationId);
}

/** GET /api/notifications/preferences — shortcut. */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
