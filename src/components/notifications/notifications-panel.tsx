"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import type { Notification } from "@domain/schemas/notification";

const KIND_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "accent"> = {
  scan_complete: "info",
  new_match: "success",
  application_update: "accent",
  quota_reached: "warning",
  relocation_milestone: "neutral",
  system: "neutral",
};

export function NotificationsPanel({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    router.refresh();
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }),
    });
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex items-center justify-between">
          <Badge tone="accent">{unread} unread</Badge>
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-[0.8125rem] font-medium text-accent hover:underline"
          >
            Mark all read
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            onClick={() => !n.read && void markRead(n.id)}
            className={`rounded-control border p-3 ${n.read ? "border-border opacity-60" : "border-border-strong bg-surface-muted cursor-pointer"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[0.875rem] font-medium text-ink">{n.title}</p>
                  <Badge tone={KIND_TONES[n.kind] ?? "neutral"}>{n.kind.replace(/_/g, " ")}</Badge>
                  {n.deliveryStatus === "provider_unconfigured" && (
                    <Badge tone="neutral">stored (no email provider)</Badge>
                  )}
                </div>
                <p className="text-[0.8125rem] text-ink-muted">{n.body}</p>
              </div>
              <RelativeTime value={n.createdAt} className="shrink-0 text-[0.75rem] text-ink-subtle" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
