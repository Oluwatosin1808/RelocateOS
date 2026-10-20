"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { RelativeTime } from "@/components/ui/relative-time";

type SourceDto = {
  id: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  healthStatus: "healthy" | "degraded" | "unconfigured" | "failing";
  lastSuccessfulSyncAt: string | null;
  lastFailureReason: string;
  jobsLastScan: number;
  capabilities: { submitApplications: boolean };
};

const healthTone: Record<SourceDto["healthStatus"], Tone> = {
  healthy: "success",
  degraded: "warning",
  failing: "danger",
  unconfigured: "neutral",
};

const healthLabel: Record<SourceDto["healthStatus"], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  failing: "Failing",
  unconfigured: "Not checked",
};

async function fetchSources(): Promise<SourceDto[]> {
  const res = await fetch("/api/sources");
  if (!res.ok) throw new Error("Could not load sources.");
  const body = (await res.json()) as { sources: SourceDto[] };
  return body.sources;
}

export function SourcesPanel() {
  const toast = useToast();
  const router = useRouter();
  const [sources, setSources] = React.useState<SourceDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchSources()
      .then((list) => {
        if (!cancelled) setSources(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load sources.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setError(null);
    try {
      setSources(await fetchSources());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sources.");
    }
  }

  async function checkHealth(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/sources/${encodeURIComponent(id)}/health`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!res.ok) throw new Error("Health check failed.");
      toast.push(
        body?.ok ? `Healthy — ${body.message ?? ""}` : `Issue — ${body?.message ?? "check failed"}`,
        body?.ok ? "success" : "error",
      );
      await refresh();
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Health check failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnabled(source: SourceDto) {
    setBusyId(source.id);
    try {
      const res = await fetch(`/api/sources/${encodeURIComponent(source.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      if (!res.ok) throw new Error("Could not update source.");
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update source.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Job sources</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Health is checked live. Public boards only ever expose discovery — submission stays
            external until a real employer integration exists.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          Refresh
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {error && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        {sources === null && !error && (
          <div className="h-20 w-full animate-pulse rounded-card bg-surface-muted" />
        )}
        {sources?.length === 0 && (
          <p className="text-[0.875rem] text-ink-muted">
            No sources configured. Add boards from onboarding or Settings.
          </p>
        )}
        {sources?.map((source) => (
          <div
            key={source.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-[0.875rem] font-medium">
                {source.displayName} <span className="text-ink-subtle">· {source.provider}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={healthTone[source.healthStatus]}>
                  {healthLabel[source.healthStatus]}
                </Badge>
                <Badge tone={source.enabled ? "info" : "neutral"}>
                  {source.enabled ? "Enabled" : "Disabled"}
                </Badge>
                {!source.capabilities.submitApplications && (
                  <Badge tone="neutral">Discovery only</Badge>
                )}
                <span className="text-[0.75rem] text-ink-subtle">
                  last sync <RelativeTime value={source.lastSuccessfulSyncAt} />
                </span>
              </div>
              {source.lastFailureReason && (
                <p className="text-[0.75rem] text-danger">{source.lastFailureReason}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={busyId === source.id}
                onClick={() => void checkHealth(source.id)}
              >
                Check health
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={busyId === source.id}
                onClick={() => void toggleEnabled(source)}
              >
                {source.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
