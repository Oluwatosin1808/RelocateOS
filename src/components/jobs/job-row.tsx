import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { ScoreMeter } from "@/components/ui/score-meter";
import type { Job } from "@domain/schemas/job";

const countryLabel: Record<string, string> = { NL: "Netherlands", BE: "Belgium", OTHER: "Other" };
const workplaceLabel: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  unspecified: "Unspecified",
};

export function JobRow({
  job,
  minSalary,
  score,
  selected,
  onToggle,
}: {
  job: Job;
  minSalary?: number | null;
  score?: number | null;
  selected?: boolean;
  onToggle?: (id: string, selected: boolean) => void;
}) {
  const salary =
    job.salaryMonthlyEurMin != null
      ? `€${job.salaryMonthlyEurMin.toLocaleString("en-GB")}${
          job.salaryMonthlyEurMax != null
            ? `–${job.salaryMonthlyEurMax.toLocaleString("en-GB")}`
            : "+"
        } /mo`
      : null;
  const aboveFloor =
    minSalary != null && job.salaryMonthlyEurMin != null
      ? job.salaryMonthlyEurMin >= minSalary
      : null;

  return (
    <div className="rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex flex-wrap items-start gap-3">
        {onToggle && (
          <label className="mt-1 flex items-center" aria-label={`Select ${job.title}`}>
            <input
              type="checkbox"
              className="size-4 rounded-[3px] border border-border-strong accent-accent"
              checked={selected ?? false}
              onChange={(e) => onToggle(job.id, e.target.checked)}
            />
          </label>
        )}
        <Link href={`/scout/${encodeURIComponent(job.id)}`} className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[0.9375rem] font-semibold text-ink">{job.title}</p>
          <p className="text-[0.8125rem] text-ink-muted">
            {job.employerName}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{countryLabel[job.country] ?? job.country}</Badge>
            <Badge tone="neutral">{workplaceLabel[job.workplaceType] ?? job.workplaceType}</Badge>
            {salary && (
              <Badge tone={aboveFloor ? "success" : "neutral"}>
                {salary}
                {aboveFloor === true ? " · above floor" : ""}
              </Badge>
            )}
            {score != null && (
              <Badge tone={score >= 70 ? "success" : score >= 50 ? "warning" : "neutral"}>
                score {score}
              </Badge>
            )}
            {job.requiredSkills.slice(0, 3).map((s) => (
              <Badge key={s} tone="info">
                {s}
              </Badge>
            ))}
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={job.status === "shortlisted" ? "success" : "neutral"}>{job.status}</Badge>
          <RelativeTime value={job.discoveredAt} className="text-[0.75rem] text-ink-subtle" />
        </div>
      </div>
    </div>
  );
}

export function JobListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading jobs">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 w-full animate-pulse rounded-card bg-surface-muted" />
      ))}
    </div>
  );
}

export function formatSalaryRange(job: Job): string {
  if (job.salaryMonthlyEurMin == null) return "Undisclosed";
  const min = job.salaryMonthlyEurMin.toLocaleString("en-GB");
  const max = job.salaryMonthlyEurMax?.toLocaleString("en-GB");
  return max ? `€${min}–${max} / month` : `€${min}+ / month`;
}

export function FitIndicator({ job, minSalary }: { job: Job; minSalary?: number | null }) {
  if (minSalary == null || job.salaryMonthlyEurMin == null) {
    return <ScoreMeter score={null} />;
  }
  const ratio = job.salaryMonthlyEurMin / minSalary;
  const score = Math.min(100, Math.round(ratio * 70));
  return <ScoreMeter score={score} />;
}
