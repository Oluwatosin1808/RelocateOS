import { getSessionUser } from "@/lib/auth/session";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { getJob } from "@/lib/jobs/dal";
import { buildCoverLetterDocument } from "@domain/documents/builders";
import { renderDocx } from "@/lib/documents/render";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { z } from "zod";

const querySchema = z.object({
  jobId: z.string().min(1).max(200),
});

/**
 * GET /api/documents/cover-letter?jobId=… — download a DOCX cover letter
 * skeleton built from verified facts + the target job's real details.
 * The user must review/edit before export; nothing is hallucinated.
 */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.documents.cover-letter", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in to continue.", { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ jobId: url.searchParams.get("jobId") });
  if (!parsed.success) {
    return new Response("Missing or invalid jobId.", { status: 400 });
  }

  const [profile, job] = await Promise.all([
    loadCandidateProfile(user.uid),
    getJob(parsed.data.jobId),
  ]);
  if (!profile) {
    return new Response("Complete your profile before generating a cover letter.", { status: 400 });
  }
  if (!job) {
    return new Response("Job not found.", { status: 404 });
  }

  const model = buildCoverLetterDocument({
    profile,
    job: {
      title: job.title,
      employerName: job.employerName,
      location: job.location,
      city: job.city,
      country: job.country,
    },
  });
  const buffer = await renderDocx(model);

  const slug = `${job.employerName}-${job.title}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
  log.info("cover_letter_generated", { uid: user.uid, jobId: job.id, blocks: model.blocks.length });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="cover-letter-${slug}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
