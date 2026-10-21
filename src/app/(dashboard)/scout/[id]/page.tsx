import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { getJob } from "@/lib/jobs/dal";
import { getJobScore } from "@/lib/jobs/scoring-dal";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { FitIndicator, formatSalaryRange } from "@/components/jobs/job-row";
import { JobActions } from "@/components/jobs/job-actions";
import { ApplyKit } from "@/components/jobs/apply-kit";
import { buildStandardAnswers } from "@domain/applications/answers";
import { ScorePanel } from "@/components/jobs/score-panel";
import { AiAnalysisPanel } from "@/components/jobs/ai-analysis-panel";
import { DownloadDocButton } from "@/components/documents/download-button";

export const metadata = { title: "Job detail" };

type Params = Promise<{ id: string }>;

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
      <PageContent params={params} />
    </Suspense>
  );
}

async function PageContent({ params }: { params: Params }) {
  const { user } = await requireOnboardedUser();
  const { id } = await params;
  const [job, profile, existingScore] = await Promise.all([
    getJob(id),
    loadCandidateProfile(user.uid),
    getJobScore(id),
  ]);
  if (!job) {
    notFound();
  }
  const minSalary = profile?.salaryPreferences.minGrossMonthlyEur ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={
          <Link href="/scout" className="text-accent hover:underline">
            ← Back to Scout
          </Link>
        }
        title={job.title}
        description={`${job.employerName}${job.location ? ` · ${job.location}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={job.status === "shortlisted" ? "success" : "neutral"}>{job.status}</Badge>
            <Badge tone="neutral">{job.provider}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3>About this role</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {job.descriptionHtml ? (
              // Description HTML comes from the ATS feed; we render it only after
              // sanitising on the server (Phase 2 keeps plain text fallback).
              <p className="text-[0.875rem] leading-relaxed text-ink-muted">
                {job.description.slice(0, 4000)}
                {job.description.length > 4000 ? "…" : ""}
              </p>
            ) : (
              <p className="text-[0.875rem] text-ink-muted">
                {job.description || "No description provided by the source."}
              </p>
            )}
            {job.requiredSkills.length > 0 && (
              <div className="space-y-2">
                <p className="text-[0.8125rem] font-medium">Required skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((s) => (
                    <Badge key={s} tone="info">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3>Details</h3>
          </CardHeader>
          <CardBody className="space-y-3 text-[0.875rem]">
            <Row label="Salary" value={formatSalaryRange(job)} />
            <Row label="Workplace" value={job.workplaceType} />
            <Row label="Employment" value={job.employmentType} />
            <Row label="Country" value={job.country} />
            <div className="space-y-1">
              <p className="text-[0.8125rem] text-ink-muted">Salary fit</p>
              <FitIndicator job={job} minSalary={minSalary} />
            </div>
            <Row
              label="Discovered"
              value={<RelativeTime value={job.discoveredAt} />}
            />
            <Row
              label="Published"
              value={job.publishedAt ? <RelativeTime value={job.publishedAt} /> : "—"}
            />
            <div className="space-y-1">
              <p className="text-[0.8125rem] text-ink-muted">Application method</p>
              <Badge tone={job.applicationMethod === "external_apply" ? "warning" : "neutral"}>
                {job.applicationMethod === "external_apply"
                  ? "External apply (opens employer site)"
                  : job.applicationMethod}
              </Badge>
            </div>
            {job.applicationUrl && (
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-[0.875rem] font-medium text-accent hover:underline"
              >
                Open on employer site ↗
              </a>
            )}
          </CardBody>
        </Card>
      </div>

      <JobActions jobId={job.id} status={job.status} applicationUrl={job.applicationUrl} />

      {profile && (
        <ApplyKit
          jobId={job.id}
          answers={buildStandardAnswers(profile, job)}
          applyUrl={job.applicationUrl || job.canonicalUrl}
        />
      )}

      <Card>
        <CardHeader>
          <h3>Application documents</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-[0.8125rem] text-ink-muted">
            Generated from your verified profile facts only. Review and edit each draft before
            submitting — nothing is auto-sent.
          </p>
          <div className="flex flex-wrap gap-2">
            <DownloadDocButton
              href={`/api/documents/cover-letter?jobId=${encodeURIComponent(job.id)}`}
              label="Cover letter (.docx)"
            />
            <DownloadDocButton href="/api/documents/cv" label="Full CV (.docx)" />
          </div>
        </CardBody>
      </Card>

      <ScorePanel jobId={job.id} initialScore={existingScore} />

      <AiAnalysisPanel jobId={job.id} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[0.8125rem] text-ink-muted">{label}</p>
      <p className="text-ink">{value}</p>
    </div>
  );
}
