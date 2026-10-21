import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { connection } from "next/server";
import { loadCvOriginal, cvStorePathFor } from "@/lib/storage/cv-store";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";

/**
 * GET /api/cv-files/[id] — download an uploaded CV original (PDF/DOC/DOCX/TXT).
 * The id is "{uid}__{cvFileId}"; users can only fetch their own files.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.cv-files", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return new Response("Sign in to continue.", { status: 401 });
  }

  const rawId = decodeURIComponent((await ctx.params).id);
  if (!rawId.startsWith(`${user.uid}__`)) {
    return new Response("Not found.", { status: 404 });
  }
  const cvFileId = rawId.slice(user.uid.length + 2);
  if (!cvFileId || cvFileId.includes("/")) {
    return new Response("Not found.", { status: 404 });
  }

  // Prefer the path recorded on the profile; fall back to the cvstore id.
  await connection();
  const profileSnap = await adminDb().doc(`candidateProfiles/${user.uid}`).get();
  const cvFiles = (profileSnap.data()?.cvFiles ?? []) as { id: string; storagePath: string }[];
  const entry = cvFiles.find((f) => f.id === cvFileId);
  const storagePath = entry?.storagePath || cvStorePathFor(user.uid, cvFileId);

  const file = await loadCvOriginal(storagePath);
  if (!file) {
    log.warn("cv_file_missing", { uid: user.uid, cvFileId });
    return new Response("File not found.", { status: 404 });
  }

  const safeName = (file.originalName || "cv-file").replace(/["\\]/g, "_");
  log.info("cv_file_downloaded", { uid: user.uid, cvFileId, bytes: file.buffer.length });

  return new Response(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(file.buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
