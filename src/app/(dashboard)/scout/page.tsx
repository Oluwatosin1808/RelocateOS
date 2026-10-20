import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { listJobs } from "@/lib/jobs/dal";
import { getJobScores } from "@/lib/jobs/scoring-dal";
import { Card, CardBody, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { JobListSkeleton } from "@/components/jobs/job-row";
import { ScoutFilters, ScanButton, LoadMoreButton } from "@/components/jobs/scout-controls";
import { ScoutJobList } from "@/components/jobs/scout-job-list";
import { SourcesPanel } from "@/components/jobs/sources-panel";
import type { CountryCode, JobStatus } from "@domain/schemas/job";

export const metadata = { title: "Job Scout" };

type SearchParams = Promise<{
  status?: string;
  country?: string;
  q?: string;
  cursor?: string;
  sort?: string;
}>;

const VALID_STATUSES: JobStatus[] = ["discovered", "analysed", "shortlisted", "archived", "expired"];
const VALID_COUNTRIES: CountryCode[] = ["NL", "BE", "OTHER"];

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Discovery"
        title="Job Scout"
        description="Genuine vacancies from your configured job sources, deduplicated and scored against your verified profile."
        actions={
          <Suspense>
            <ScanButton />
          </Suspense>
        }
      />
      <Suspense fallback={<JobListSkeleton />}>
        <JobsSection searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<div className="h-32 w-full animate-pulse rounded-card bg-surface-muted" />}>
        <SourcesSection />
      </Suspense>
    </div>
  );
}

async function JobsSection({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireOnboardedUser();
  const params = await searchParams;
  const status: JobStatus = VALID_STATUSES.includes(params.status as JobStatus)
    ? (params.status as JobStatus)
    : "discovered";
  const country: CountryCode | null = VALID_COUNTRIES.includes(params.country as CountryCode)
    ? (params.country as CountryCode)
    : null;
  const q = params.q?.trim() ? params.q.trim().slice(0, 120) : null;
  const cursor = params.cursor?.trim() ? params.cursor.trim().slice(0, 200) : null;
  const sortByScore = params.sort === "score";

  const [{ jobs, nextCursor, hasMore }, profile] = await Promise.all([
    listJobs({ status, country, q, cursor, limit: 50, sortByScore }),
    loadCandidateProfile(user.uid),
  ]);
  const minSalary = profile?.salaryPreferences.minGrossMonthlyEur ?? null;
  const scores = await getJobScores(jobs.map((j) => j.id));

  // Build the "load more" URL preserving current filters.
  const nextParams = new URLSearchParams();
  if (status !== "discovered") nextParams.set("status", status);
  if (country) nextParams.set("country", country);
  if (q) nextParams.set("q", q);
  if (sortByScore) nextParams.set("sort", "score");
  if (nextCursor) nextParams.set("cursor", nextCursor);
  const nextHref = nextParams.toString() ? `/scout?${nextParams.toString()}` : "/scout";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <ScoutFilters status={status} country={country} q={q} sort={sortByScore ? "score" : "recent"} />
        </Suspense>
        <span className="text-[0.8125rem] text-ink-subtle">
          {jobs.length} job{jobs.length === 1 ? "" : "s"}
          {cursor ? " (page)" : ""}
        </span>
        {minSalary != null && (
          <Badge tone="info">Salary floor €{minSalary.toLocaleString("en-GB")}/mo</Badge>
        )}
      </div>
      {jobs.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No jobs match"
              description={
                q || country || cursor
                  ? "No jobs match these filters. Try clearing the search, country, or going back a page."
                  : "Run a discovery scan to pull real vacancies from your enabled sources. Nothing is pre-seeded."
              }
              action={
                !q && !country && !cursor ? (
                  <ScanButton label="Run first scan" />
                ) : null
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <ScoutJobList
            jobs={jobs}
            minSalary={minSalary}
            scores={Object.fromEntries(scores)}
          />
          {hasMore && nextCursor && <LoadMoreButton href={nextHref} />}
        </>
      )}
    </div>
  );
}

async function SourcesSection() {
  await requireOnboardedUser();
  return <SourcesPanel />;
}
