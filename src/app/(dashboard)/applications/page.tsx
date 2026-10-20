import { Suspense } from "react";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { listApplications, countTodaySubmissions } from "@/lib/applications/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { checkQuota } from "@domain/applications/quota";
import { Card, CardBody, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { ApplicationRow, QuotaBar } from "@/components/applications/application-row";
import type { ApplicationStatus } from "@domain/schemas/application";

export const metadata = { title: "Applications" };

type SearchParams = Promise<{ status?: string }>;

const VALID_STATUSES: ApplicationStatus[] = [
  "draft", "queued", "submitted", "external_confirmed",
  "in_review", "interview", "offer", "rejected", "withdrawn", "expired",
];

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Tracking"
        title="Applications"
        description="Every application state transition recorded from real actions — never assumed outcomes."
      />
      <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireOnboardedUser();
  const params = await searchParams;
  const status = VALID_STATUSES.includes(params.status as ApplicationStatus)
    ? (params.status as ApplicationStatus)
    : null;

  const [applications, usedToday, profile] = await Promise.all([
    listApplications(user.uid, { status }),
    countTodaySubmissions(user.uid),
    loadCandidateProfile(user.uid),
  ]);
  const limit = profile?.automationPreferences.maxAutoSubmissionsPerDay ?? 10;
  const quota = checkQuota(usedToday, limit);

  return (
    <div className="space-y-4">
      {/* Quota bar */}
      <Card>
        <CardBody>
          <QuotaBar used={quota.used} limit={quota.limit} />
          <p className="mt-2 text-[0.8125rem] text-ink-muted">{quota.reason}</p>
        </CardBody>
      </Card>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/applications"
          className={`rounded-full border px-3 py-1 text-[0.8125rem] font-medium ${!status ? "border-accent/30 bg-accent-subtle text-accent" : "border-border text-ink-muted hover:bg-surface-muted"}`}
        >
          All
        </Link>
        {VALID_STATUSES.filter((s) =>
          applications.some((a) => a.status === s) || ["submitted", "interview", "offer"].includes(s),
        ).map((s) => (
          <Link
            key={s}
            href={`/applications?status=${s}`}
            className={`rounded-full border px-3 py-1 text-[0.8125rem] font-medium ${status === s ? "border-accent/30 bg-accent-subtle text-accent" : "border-border text-ink-muted hover:bg-surface-muted"}`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No applications yet"
              description="When you shortlist a job and record an application, it appears here with an honest status history."
              action={
                <Link href="/scout" className="text-[0.8125rem] font-medium text-accent hover:underline">
                  Browse shortlisted jobs →
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => (
            <li key={app.id}>
              <ApplicationRow app={app} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
