import type { Application, ApplicationStatus } from "../schemas/application";
import type { Job, JobStatus } from "../schemas/job";

/**
 * Analytics aggregation — pure functions over persisted records.
 * Every metric shown to the user is computed from real data; nothing is
 * estimated or fabricated.
 */

export type PipelineMetrics = {
  discovered: number;
  shortlisted: number;
  applied: number;
  interviewing: number;
  offers: number;
  rejected: number;
  /** Ratio applied / shortlisted, or null when shortlisted = 0. */
  applyRate: number | null;
  /** Ratio interviewing / applied, or null when applied = 0. */
  interviewRate: number | null;
};

export type StatusBreakdown = { status: string; count: number }[];

export function computePipelineMetrics(
  jobs: Job[],
  applications: Application[],
): PipelineMetrics {
  const discovered = jobs.filter((j) => j.status !== "archived").length;
  const shortlisted = jobs.filter((j) => j.status === "shortlisted").length;
  const activeApps = applications.filter(
    (a) => !["withdrawn", "expired"].includes(a.status),
  );
  const applied = activeApps.filter((a) =>
    ["submitted", "external_confirmed", "in_review", "interview", "offer", "rejected"].includes(a.status),
  ).length;
  const interviewing = activeApps.filter((a) =>
    ["interview", "offer"].includes(a.status),
  ).length;
  const offers = activeApps.filter((a) => a.status === "offer").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;

  return {
    discovered,
    shortlisted,
    applied,
    interviewing,
    offers,
    rejected,
    applyRate: shortlisted > 0 ? Math.round((applied / shortlisted) * 100) : null,
    interviewRate: applied > 0 ? Math.round((interviewing / applied) * 100) : null,
  };
}

export function computeStatusBreakdown(applications: Application[]): StatusBreakdown {
  const counts = new Map<string, number>();
  for (const a of applications) {
    counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeCountryBreakdown(applications: Application[]): StatusBreakdown {
  const counts = new Map<string, number>();
  for (const a of applications) {
    counts.set(a.country || "OTHER", (counts.get(a.country || "OTHER") ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

/** Applications created per day for the last N days (UTC). */
export function computeDailyActivity(
  applications: Application[],
  days: number = 30,
  now: Date = new Date(),
): { day: string; count: number }[] {
  const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of applications) {
    const day = a.createdAt.slice(0, 10);
    if (day >= cutoffKey && counts.has(day)) {
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
