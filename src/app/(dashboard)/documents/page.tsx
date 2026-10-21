import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { CvFile } from "@domain/schemas/candidate-profile";

export const metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
      <PageContent />
    </Suspense>
  );
}

async function PageContent() {
  const { user } = await requireOnboardedUser();
  const profile = await loadCandidateProfile(user.uid);
  const cvFiles = (profile?.cvFiles ?? []) as CvFile[];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Documents"
        title="Documents"
        description="Tailored CVs and cover letters grounded in your verified profile, with claim-level provenance."
      />

      <Card>
        <CardHeader>
          <h3>Generated from your profile</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Built from confirmed facts only — empty sections are omitted, never padded. Cover
            letters are generated per job from the job&apos;s page in Scout.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3">
            <div>
              <p className="text-[0.875rem] font-medium text-ink">CV (DOCX)</p>
              <p className="text-[0.8125rem] text-ink-muted">
                Download a DOCX CV assembled from your verified profile.
              </p>
            </div>
            <a
              href="/api/documents/cv"
              className="rounded-control border border-border px-3 py-1.5 text-[0.8125rem] font-medium text-ink hover:bg-surface-muted"
            >
              Download DOCX
            </a>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3>Your uploaded CV files</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Originals you imported on the Profile page. PDF, DOC, DOCX and TXT are stored and
            downloadable here.
          </p>
        </CardHeader>
        <CardBody>
          {cvFiles.length === 0 ? (
            <EmptyState
              title="No CV files yet"
              description="Upload a CV on the Profile page — the original file is stored here and its text becomes available for review."
            />
          ) : (
            <ul className="space-y-2">
              {cvFiles.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem] font-medium text-ink">{f.originalName}</p>
                    <p className="text-[0.8125rem] text-ink-muted">
                      {(f.sizeBytes / 1024).toFixed(0)} KB · uploaded{" "}
                      {new Date(f.uploadedAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{f.contentType.includes("pdf") ? "PDF" : f.contentType.includes("word") ? "Word" : "File"}</Badge>
                    <a
                      href={`/api/cv-files/${encodeURIComponent(`${user.uid}__${f.id}`)}`}
                      className="rounded-control border border-border px-3 py-1.5 text-[0.8125rem] font-medium text-ink hover:bg-surface-muted"
                    >
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
