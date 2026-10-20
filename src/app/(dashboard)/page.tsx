import { Suspense } from "react";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getAnalyticsSnapshot } from "@/lib/analytics/dal";
import { Card, CardBody, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ScoreMeter } from "@/components/ui/score-meter";

export const metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
      <OverviewContent />
    </Suspense>
  );
}

async function OverviewContent() {
  const { user, doc } = await requireOnboardedUser();
  const snapshot = await getAnalyticsSnapshot(user.uid);
  const { pipeline } = snapshot;
  const hasData = pipeline.discovered > 0 || pipeline.applied > 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Overview"
        title={`Welcome${doc.displayName ? `, ${doc.displayName}` : ""}`}
        description="Your job-search operations at a glance. Every metric is computed from persisted records."
      />

      {hasData ? (
        <>
          {/* Pipeline metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Jobs discovered" value={pipeline.discovered} />
            <MetricCard label="Shortlisted" value={pipeline.shortlisted} />
            <MetricCard label="Applications" value={pipeline.applied} />
            <MetricCard label="Interviews" value={pipeline.interviewing} />
          </div>

          {/* Rates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardBody className="space-y-2">
                <p className="text-[0.8125rem] text-ink-muted">Apply rate</p>
                {pipeline.applyRate !== null ? (
                  <ScoreMeter score={pipeline.applyRate} />
                ) : (
                  <p className="text-[0.875rem] text-ink-subtle">No shortlisted jobs yet</p>
                )}
                <p className="text-[0.8125rem] text-ink-subtle">
                  Shortlisted → applied
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-2">
                <p className="text-[0.8125rem] text-ink-muted">Interview rate</p>
                {pipeline.interviewRate !== null ? (
                  <ScoreMeter score={pipeline.interviewRate} />
                ) : (
                  <p className="text-[0.875rem] text-ink-subtle">No applications yet</p>
                )}
                <p className="text-[0.8125rem] text-ink-subtle">Applied → interviewing</p>
              </CardBody>
            </Card>
          </div>

          {/* Country + status breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardBody>
                <p className="mb-3 text-[0.8125rem] font-medium">Applications by status</p>
                <BreakdownList items={snapshot.statusBreakdown} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="mb-3 text-[0.8125rem] font-medium">By country</p>
                <BreakdownList items={snapshot.countryBreakdown} />
              </CardBody>
            </Card>
          </div>

          {/* Top employers */}
          {snapshot.topEmployers.length > 0 && (
            <Card>
              <CardBody>
                <p className="mb-3 text-[0.8125rem] font-medium">Top employers</p>
                <BreakdownList items={snapshot.topEmployers.map((e) => ({ status: e.employer, count: e.count }))} />
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              title="Pipeline not started yet"
              description="Once job sources are configured and the first scan runs, discovered jobs, matches and applications will appear here."
              action={
                <Link
                  href="/automation"
                  className="text-[0.8125rem] font-medium text-accent hover:underline"
                >
                  Configure job sources →
                </Link>
              }
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-[0.8125rem] text-ink-muted">{label}</p>
        <p className="data-font text-[1.75rem] font-semibold">{value}</p>
      </CardBody>
    </Card>
  );
}

function BreakdownList({ items }: { items: { status: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.status} className="flex items-center gap-3">
          <span className="w-32 truncate text-[0.8125rem] text-ink-muted">
            {item.status.replace(/_/g, " ")}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="data-font w-8 text-right text-[0.8125rem] font-semibold">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
