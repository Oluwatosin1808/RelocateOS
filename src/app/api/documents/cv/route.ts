import { getSessionUser } from "@/lib/auth/session";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { buildCvDocument } from "@domain/documents/builders";
import { renderDocx } from "@/lib/documents/render";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";

/**
 * GET /api/documents/cv — download a DOCX CV built from verified profile facts.
 * Only confirmed, user-asserted or reviewed-import facts appear; empty sections
 * are omitted rather than filled with placeholders.
 */
export async function GET(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.documents.cv", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in to continue.", { status: 401 });
  }

  const profile = await loadCandidateProfile(user.uid);
  if (!profile) {
    return new Response("Complete your profile before generating a CV.", { status: 400 });
  }

  const model = buildCvDocument(profile);
  const buffer = await renderDocx(model);

  const safeName = (profile.contact.fullName || "cv")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  log.info("cv_generated", { uid: user.uid, blocks: model.blocks.length });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}-cv.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
