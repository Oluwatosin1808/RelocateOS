"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { CountryCode } from "@domain/schemas/job";

export function ScanButton({ label = "Run scan" }: { label?: string }) {
  const toast = useToast();
  const router = useRouter();
  const [running, setRunning] = React.useState(false);

  async function runScan() {
    setRunning(true);
    try {
      const res = await fetch("/api/scout/scan", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | {
            error?: { message?: string };
            jobsDiscovered?: number;
            jobsInserted?: number;
            sourcesSucceeded?: number;
            sourcesFailed?: number;
          }
        | null;
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Scan failed.");
      }
      const parts = [
        body?.jobsInserted != null ? `${body.jobsInserted} new` : null,
        body?.jobsDiscovered != null ? `${body.jobsDiscovered} seen` : null,
        body?.sourcesSucceeded != null
          ? `${body.sourcesSucceeded} source${body.sourcesSucceeded === 1 ? "" : "s"} ok`
          : null,
        body?.sourcesFailed ? `${body.sourcesFailed} failed` : null,
      ].filter(Boolean);
      toast.push(
        parts.length ? `Scan complete — ${parts.join(", ")}.` : "Scan complete.",
        body?.sourcesFailed ? "info" : "success",
      );
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Scan failed.", "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button onClick={runScan} loading={running}>
      {label}
    </Button>
  );
}

export function ScoutFilters({
  status,
  country,
  q,
  sort,
}: {
  status: string;
  country: CountryCode | null;
  q: string | null;
  sort: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(q ?? "");

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("cursor");
    router.push(`/scout?${params.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: query });
      }}
    >
      <Select
        aria-label="Status"
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
        className="w-auto"
      >
        <option value="discovered">Discovered</option>
        <option value="analysed">Analysed</option>
        <option value="shortlisted">Shortlisted</option>
        <option value="archived">Archived</option>
      </Select>
      <Select
        aria-label="Country"
        value={country ?? ""}
        onChange={(e) => apply({ country: e.target.value || null })}
        className="w-auto"
      >
        <option value="">All countries</option>
        <option value="NL">Netherlands</option>
        <option value="BE">Belgium</option>
        <option value="OTHER">Other</option>
      </Select>
      <Select
        aria-label="Sort"
        value={sort}
        onChange={(e) => apply({ sort: e.target.value })}
        className="w-auto"
      >
        <option value="recent">Most recent</option>
        <option value="score">Best match</option>
      </Select>
      <Input
        aria-label="Search jobs"
        placeholder="Search title, employer, city…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-56"
      />
      <Button type="submit" variant="secondary" size="sm">
        Filter
      </Button>
    </form>
  );
}

export function LoadMoreButton({ href }: { href: string }) {
  return (
    <div className="flex justify-center pt-2">
      <Link
        href={href}
        className="inline-flex h-9 items-center rounded-control border border-border-strong px-4 text-[0.875rem] font-medium hover:bg-surface-muted"
      >
        Load more jobs →
      </Link>
    </div>
  );
}

export function BulkActionsBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function applyStatus(status: string, label: string) {
    setBusy(status);
    try {
      const res = await fetch("/api/scout/jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string }; updated?: number }
        | null;
      if (!res.ok) throw new Error(body?.error?.message ?? "Bulk update failed.");
      toast.push(`${body?.updated ?? selectedIds.length} job${(body?.updated ?? selectedIds.length) === 1 ? "" : "s"} ${label}.`, "success");
      onClear();
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Bulk update failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-accent/30 bg-accent-subtle px-4 py-2.5">
      <span className="text-[0.8125rem] font-medium text-accent">
        {selectedIds.length} selected
      </span>
      <Button size="sm" loading={busy === "shortlisted"} onClick={() => void applyStatus("shortlisted", "shortlisted")}>
        Shortlist
      </Button>
      <Button size="sm" variant="secondary" loading={busy === "archived"} onClick={() => void applyStatus("archived", "archived")}>
        Archive
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
