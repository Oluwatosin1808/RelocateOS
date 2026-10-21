import { getSessionUser } from "@/lib/auth/session";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { getJob } from "@/lib/jobs/dal";
import { buildCvDocument, buildCoverLetterDocument } from "@domain/documents/builders";
import { buildStandardAnswers, renderAnswersSheet } from "@domain/applications/answers";
import { renderDocx } from "@/lib/documents/render";
import { createZip } from "@/lib/zip/store-zip";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";

function slug(s: string): string {
  return (
    s
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "job"
  );
}

const CHECKLIST = (employer: string, title: string, applyUrl: string) => `APPLICATION CHECKLIST — ${title} at ${employer}

1. Open the employer page:  ${applyUrl}
2. Upload cv.docx (or paste into the CV field).
3. Upload cover-letter.docx into the cover letter field (review it first —
   it is drafted from your verified profile facts).
4. Paste answers from answers.txt into the matching form fields.
5. Answer every custom question yourself — do not guess; visa-relevant
   answers must be true (sponsorship, salary, notice period).
6. Submit on the employer site.
7. Back in RelocateOS: click "I applied — record it" on the job page so
   quota, pipeline tracking and notifications stay accurate.

Automated-assist (fills the form, never submits):
  npm run autofill -- <jobId>
`;

/**
 * GET /api/applications/packet?jobId=… — the application kit:
 *   cv.docx + cover-letter.docx + answers.txt + checklist.md in one ZIP.
 * ?format=json returns the answers + links for the local autofill assistant.
 * Review before submitting — nothing is ever auto-sent to employers.
 */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.applications.packet", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in to continue.", { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") ?? "";
  if (!jobId) {
    return new Response("Missing jobId.", { status: 400 });
  }

  const [profile, job] = await Promise.all([loadCandidateProfile(user.uid), getJob(jobId)]);
  if (!profile) {
    return new Response("Complete your profile before preparing an application.", { status: 400 });
  }
  if (!job) {
    return new Response("Job not found.", { status: 404 });
  }

  const answers = buildStandardAnswers(profile, job);
  const applyUrl = job.applicationUrl || job.canonicalUrl;

  if (url.searchParams.get("format") === "json") {
    return Response.json({
      job: {
        id: job.id,
        title: job.title,
        employerName: job.employerName,
        location: job.location,
        applicationUrl: applyUrl,
        provider: job.provider,
      },
      answers,
      downloads: {
        cv: "/api/documents/cv",
        coverLetter: `/api/documents/cover-letter?jobId=${encodeURIComponent(job.id)}`,
        packet: `/api/applications/packet?jobId=${encodeURIComponent(job.id)}`,
      },
    });
  }

  const [cvModel, coverModel] = [
    buildCvDocument(profile),
    buildCoverLetterDocument({ profile, job }),
  ];
  const [cvDocx, coverDocx] = await Promise.all([
    renderDocx(cvModel),
    renderDocx(coverModel),
  ]);

  const zip = createZip([
    { name: "cv.docx", data: Buffer.from(cvDocx) },
    { name: "cover-letter.docx", data: Buffer.from(coverDocx) },
    {
      name: "answers.txt",
      data: Buffer.from(renderAnswersSheet(answers, job), "utf8"),
    },
    {
      name: "checklist.md",
      data: Buffer.from(CHECKLIST(job.employerName, job.title, applyUrl), "utf8"),
    },
  ]);

  const fileName = `apply-kit-${slug(job.employerName)}-${slug(job.title)}.zip`;
  log.info("packet_generated", {
    uid: user.uid,
    jobId: job.id,
    answers: answers.length,
    bytes: zip.length,
  });

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "private, no-store",
    },
  });
}
