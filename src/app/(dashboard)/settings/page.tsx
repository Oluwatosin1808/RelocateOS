import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { listNotifications, getNotificationPreferences } from "@/lib/notifications/dal";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { NotificationPrefsForm } from "@/components/notifications/notification-prefs-form";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="Settings"
        description="Notifications, preferences, and account controls."
      />
      <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { user, doc } = await requireOnboardedUser();
  const [notifications, prefs] = await Promise.all([
    listNotifications(user.uid, { limit: 30 }),
    getNotificationPreferences(user.uid),
  ]);

  return (
    <div className="space-y-6">
      {/* Notification preferences */}
      <NotificationPrefsForm initial={prefs} />

      {/* Recent notifications */}
      <Card>
        <CardHeader>
          <h3>Recent notifications</h3>
        </CardHeader>
        <CardBody>
          {notifications.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="Scan summaries, application updates and quota alerts will appear here."
              className="py-8"
            />
          ) : (
            <NotificationsPanel initial={notifications} />
          )}
        </CardBody>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <h3>Account</h3>
        </CardHeader>
        <CardBody className="space-y-2 text-[0.875rem]">
          <p>
            <span className="text-ink-muted">Email:</span> {doc.email}
          </p>
          {doc.displayName && (
            <p>
              <span className="text-ink-muted">Name:</span> {doc.displayName}
            </p>
          )}
          <p>
            <span className="text-ink-muted">Member since:</span>{" "}
            {doc.createdAt?.slice(0, 10) ?? "—"}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
