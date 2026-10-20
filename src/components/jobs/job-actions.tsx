"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { Job } from "@domain/schemas/job";

export function JobActions({
  jobId,
  status,
  applicationUrl,
}: {
  jobId: string;
  status: Job["status"];
  applicationUrl: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [recording, setRecording] = React.useState(false);

  async function setStatus(next: Job["status"], message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/scout/jobs/${encodeURIComponent(jobId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Could not update job.");
      toast.push(message, "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update job.", "error");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Record a real application for this job. Only call this after the user has
   * actually applied (or confirms intent) — never assumed.
   */
  async function recordApplication() {
    setRecording(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          methodUsed: "external_apply",
          externalConfirmed: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Could not record application.");
      }
      toast.push("Application recorded.", "success");
      router.push("/applications");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not record application.", "error");
    } finally {
      setRecording(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-2">
        {status !== "shortlisted" && (
          <Button loading={busy} onClick={() => setStatus("shortlisted", "Shortlisted.")}>
            Shortlist
          </Button>
        )}
        {status === "shortlisted" && (
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => setStatus("discovered", "Removed from shortlist.")}
          >
            Un-shortlist
          </Button>
        )}
        {status !== "archived" && (
          <Button
            variant="ghost"
            loading={busy}
            onClick={() => setStatus("archived", "Archived.")}
          >
            Archive
          </Button>
        )}
        {applicationUrl && (
          <a
            href={applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-control border border-border-strong px-4 text-[0.875rem] font-medium hover:bg-surface-muted"
          >
            Apply on employer site ↗
          </a>
        )}
        <Button variant="secondary" loading={recording} onClick={() => void recordApplication()}>
          I applied — record it
        </Button>
        <p className="ml-auto text-[0.8125rem] text-ink-muted">
          Auto-apply is off. This source only supports external applications.
        </p>
      </CardBody>
    </Card>
  );
}
