"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { NotificationPreferences } from "@domain/schemas/notification";

export function NotificationPrefsForm({ initial }: { initial: NotificationPreferences }) {
  const router = useRouter();
  const toast = useToast();
  const [prefs, setPrefs] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  function toggle(key: keyof NotificationPreferences) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!res.ok) throw new Error("Save failed.");
      toast.push("Notification preferences saved.", "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  const rows: { key: keyof NotificationPreferences; label: string; detail: string }[] = [
    { key: "emailEnabled", label: "Email notifications", detail: "Send notifications by email when a provider is configured." },
    { key: "scanSummaries", label: "Scan summaries", detail: "Get notified when a scheduled or manual scan completes." },
    { key: "newMatchAlerts", label: "New match alerts", detail: "Get notified when high-scoring jobs are discovered." },
    { key: "applicationUpdates", label: "Application updates", detail: "Get notified about application status changes." },
    { key: "weeklyDigest", label: "Weekly digest", detail: "Receive a weekly summary of your pipeline." },
  ];

  return (
    <Card>
      <CardHeader>
        <h3>Notification preferences</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-medium text-ink">{row.label}</p>
              <p className="text-[0.8125rem] text-ink-muted">{row.detail}</p>
            </div>
            <Switch checked={prefs[row.key]} onChange={() => toggle(row.key)} />
          </div>
        ))}
        <Button loading={busy} onClick={() => void save()}>
          Save preferences
        </Button>
      </CardBody>
    </Card>
  );
}
