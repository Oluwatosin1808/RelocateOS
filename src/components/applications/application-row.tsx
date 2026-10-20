"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONES } from "@domain/applications/quota";
import type { Application, ApplicationStatus } from "@domain/schemas/application";

const TRANSITION_OPTIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["queued", "external_confirmed", "withdrawn"],
  queued: ["submitted", "external_confirmed", "withdrawn"],
  submitted: ["in_review", "interview", "offer", "rejected", "withdrawn"],
  external_confirmed: ["in_review", "interview", "offer", "rejected", "withdrawn"],
  in_review: ["interview", "offer", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["withdrawn"],
  rejected: [],
  withdrawn: [],
  expired: [],
};

export function ApplicationRow({ app }: { app: Application }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [notes, setNotes] = React.useState(app.notes);
  const [showNotes, setShowNotes] = React.useState(false);

  const nextStatuses = TRANSITION_OPTIONS[app.status] ?? [];

  async function transition(to: ApplicationStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(app.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Update failed.");
      }
      toast.push(`Moved to "${APPLICATION_STATUS_LABELS[to]}".`, "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(app.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Save failed.");
      toast.push("Notes saved.", "success");
      setShowNotes(false);
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-[0.9375rem] font-semibold text-ink">{app.jobTitle}</p>
          <p className="text-[0.8125rem] text-ink-muted">
            {app.employerName} · {app.country}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={APPLICATION_STATUS_TONES[app.status]}>
              {APPLICATION_STATUS_LABELS[app.status]}
            </Badge>
            <Badge tone="neutral">{app.methodUsed.replace(/_/g, " ")}</Badge>
            {app.externalConfirmedAt && (
              <Badge tone="info">Applied {app.externalConfirmedAt.slice(0, 10)}</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {nextStatuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === "rejected" || s === "withdrawn" ? "ghost" : "secondary"}
              loading={busy}
              onClick={() => void transition(s)}
            >
              {APPLICATION_STATUS_LABELS[s]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setShowNotes((v) => !v)}>
            Notes
          </Button>
        </div>
      </div>
      {showNotes && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes about this application…"
            rows={3}
          />
          <Button size="sm" loading={busy} onClick={() => void saveNotes()}>
            Save notes
          </Button>
        </div>
      )}
      {app.notes && !showNotes && (
        <p className="mt-2 text-[0.8125rem] text-ink-muted">{app.notes}</p>
      )}
    </div>
  );
}

export function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-success";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[0.8125rem]">
        <span className="text-ink-muted">Daily submission quota</span>
        <span className="data-font font-semibold">
          {used}/{limit}
        </span>
      </div>
      <div
        role="img"
        aria-label={`Daily quota: ${used} of ${limit} used`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
