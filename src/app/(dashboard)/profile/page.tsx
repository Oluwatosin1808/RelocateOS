import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { loadCandidateProfile, emptyCandidateProfile } from "@/lib/profile/dal";
import { computeProfileCompleteness } from "@domain/schemas/candidate-profile";
import { Card, CardBody, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ProfileEditorForm } from "@/components/profile/profile-editor-form";
import { CvImportReview } from "@/components/profile/cv-import-review";
import { ExperienceSections } from "@/components/profile/experience-sections";
import { SponsorshipAssessmentPanel } from "@/components/immigration/sponsorship-panel";
import { DownloadDocButton } from "@/components/documents/download-button";

export const metadata = { title: "Candidate Profile" };

export default function Page() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Profile"
        title="Candidate Profile"
        description="The single source of truth for every generated application document. Only values you enter or confirm are stored."
      />
      <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
        <PageContent />
      </Suspense>
    </div>
  );
}

async function PageContent() {
  const { user } = await requireOnboardedUser();
  const profile = (await loadCandidateProfile(user.uid)) ?? emptyCandidateProfile(new Date().toISOString());
  const completeness = computeProfileCompleteness(profile);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.8125rem] text-ink-muted">Profile completeness</p>
              <p className="data-font text-[1.5rem] font-semibold">{completeness.score}%</p>
            </div>
            <DownloadDocButton href="/api/documents/cv" label="Download CV (.docx)" />
            {completeness.missing.length > 0 && (
              <ul className="space-y-1 text-[0.8125rem] text-ink-muted">
                {completeness.missing.map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
            )}
            {completeness.missing.length === 0 && (
              <EmptyState
                title="Profile complete"
                description="All required sections are filled. Application drafts can use every fact."
                className="py-4"
              />
            )}
          </div>
        </CardBody>
      </Card>
      <ProfileEditorForm profile={profile} />
      <ExperienceSections profile={profile} />
      <SponsorshipAssessmentPanel />
      <CvImportReview profile={profile} />
    </div>
  );
}
