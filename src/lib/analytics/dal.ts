import "server-only";
import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jobSchema, type Job } from "@domain/schemas/job";
import { applicationSchema, type Application } from "@domain/schemas/application";
import {
  computePipelineMetrics,
  computeStatusBreakdown,
  computeCountryBreakdown,
  computeDailyActivity,
  type PipelineMetrics,
  type StatusBreakdown,
} from "@domain/analytics/pipeline";

export type AnalyticsSnapshot = {
  pipeline: PipelineMetrics;
  statusBreakdown: StatusBreakdown;
  countryBreakdown: StatusBreakdown;
  dailyActivity: { day: string; count: number }[];
  topEmployers: { employer: string; count: number }[];
};

/**
 * Load and aggregate all analytics data for a user in one pass.
 * Every number is computed from persisted Firestore records.
 */
export async function getAnalyticsSnapshot(uid: string): Promise<AnalyticsSnapshot> {
  await connection();
  const db = adminDb();

  const [jobsSnap, appsSnap] = await Promise.all([
    db.collection("jobs").limit(500).get(),
    db.collection("applications").where("uid", "==", uid).limit(500).get(),
  ]);

  const jobs: Job[] = [];
  for (const d of jobsSnap.docs) {
    const parsed = jobSchema.safeParse({ id: d.id, ...d.data() });
    if (parsed.success) jobs.push(parsed.data);
  }

  const applications: Application[] = [];
  for (const d of appsSnap.docs) {
    const parsed = applicationSchema.safeParse({ id: d.id, ...d.data() });
    if (parsed.success) applications.push(parsed.data);
  }

  // Top employers by application count
  const employerCounts = new Map<string, number>();
  for (const a of applications) {
    employerCounts.set(a.employerName, (employerCounts.get(a.employerName) ?? 0) + 1);
  }
  const topEmployers = Array.from(employerCounts.entries())
    .map(([employer, count]) => ({ employer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    pipeline: computePipelineMetrics(jobs, applications),
    statusBreakdown: computeStatusBreakdown(applications),
    countryBreakdown: computeCountryBreakdown(applications),
    dailyActivity: computeDailyActivity(applications, 30),
    topEmployers,
  };
}
