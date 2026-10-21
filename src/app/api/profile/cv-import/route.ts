import { getSessionUser } from "@/lib/auth/session";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { connection } from "next/server";
import { detectCvFormat, extractCvText } from "@/lib/documents/extract";
import { cvFileSchema } from "@domain/schemas/candidate-profile";
import { saveCvOriginalFirestore } from "@/lib/storage/cv-store";

const MAX_BYTES = 8 * 1024 * 1024;

const FORMAT_LABELS = {
  pdf: "PDF",
  docx: "DOCX",
  doc: "DOC",
  txt: "TXT",
} as const;

/**
 * CV import: extracts plain text for user review, stores the original file and
 * extracted text in Storage, and records a CvFile entry on the profile so the
 * "at least one CV file" completeness credit works. Nothing else in the profile
 * is written — the user confirms the summary separately.
 */
export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.profile.cv-import", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return jsonError(400, "invalid_form", "Expected multipart/form-data.", correlationId);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "missing_file", "Attach a CV file as `file`.", correlationId);
  }
  if (file.size === 0) {
    return jsonError(400, "empty_file", "The uploaded file is empty.", correlationId);
  }
  if (file.size > MAX_BYTES) {
    return jsonError(413, "too_large", "CV files must be 8 MB or smaller.", correlationId);
  }

  const contentType = file.type || "application/octet-stream";
  const format = detectCvFormat(contentType, file.name);
  if (!format) {
    return jsonError(
      415,
      "unsupported_type",
      "Upload a .pdf, .doc, .docx, or .txt CV.",
      correlationId,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await extractCvText(buffer, format);
  if (!result.ok) {
    log.warn("cv_extract_failed", { format, error: result.error });
    const code = result.error.startsWith("No extractable") ? "no_text" : "extract_failed";
    return jsonError(422, code, result.error, correlationId);
  }
  const extractedText = result.text;

  // Persist: original binary + extracted text. Preferred backend is Firebase
  // Storage (needs billing); on Spark plans we fall back to the Firestore-
  // chunked CV store so the original file is never silently dropped.
  const docId = `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const originalPath = `users/${user.uid}/cv-imports/${docId}.${format}`;
  const textPath = `users/${user.uid}/cv-imports/${docId}.txt`;
  let storageOk = true;
  let storageBackend: "gcs" | "firestore" = "gcs";
  let originalStoragePath = originalPath;
  let textStoragePath = textPath;

  try {
    const bucket = adminStorage().bucket();
    await Promise.all([
      bucket.file(originalPath).save(buffer, { contentType, resumable: false }),
      bucket.file(textPath).save(Buffer.from(extractedText, "utf8"), {
        contentType: "text/plain; charset=utf-8",
        resumable: false,
      }),
    ]);
  } catch (gcsErr) {
    log.warn("cv_storage_gcs_unavailable", {
      error: gcsErr instanceof Error ? gcsErr.message : String(gcsErr),
    });
    try {
      originalStoragePath = await saveCvOriginalFirestore({
        uid: user.uid,
        docId,
        buffer,
        contentType,
        originalName: file.name,
        extractedText,
      });
      textStoragePath = `${originalStoragePath}#text`;
      storageBackend = "firestore";
      log.info("cv_storage_fallback_firestore", { uid: user.uid, docId });
    } catch (fsErr) {
      storageOk = false;
      originalStoragePath = "";
      textStoragePath = "";
      log.warn("cv_storage_unavailable", {
        error: fsErr instanceof Error ? fsErr.message : String(fsErr),
      });
    }
  }

  const uploadedAt = new Date().toISOString();
  let cvFileId: string | null = null;

  if (storageOk) {
    const cvFile = cvFileSchema.parse({
      id: docId,
      storagePath: originalStoragePath,
      originalName: file.name,
      contentType,
      sizeBytes: file.size,
      uploadedAt,
      extractedTextChars: extractedText.length,
    });

    await connection();
    const profileRef = adminDb().doc(`candidateProfiles/${user.uid}`);
    const profileSnap = await profileRef.get();
    const existingFiles: unknown[] = Array.isArray(profileSnap.data()?.cvFiles)
      ? (profileSnap.data()?.cvFiles as unknown[])
      : [];
    const nextFiles = [...existingFiles, cvFile].slice(-20);
    await profileRef.set({ cvFiles: nextFiles, updatedAt: uploadedAt }, { merge: true });
    cvFileId = docId;
  }

  log.info("cv_text_extracted", {
    uid: user.uid,
    chars: extractedText.length,
    method: format,
    storageOk,
    storageBackend,
    cvFileId,
  });

  return jsonOk({
    extractedText: extractedText.slice(0, 20000),
    truncated: extractedText.length > 20000,
    originalChars: extractedText.length,
    storagePath: textStoragePath,
    originalStoragePath,
    originalName: file.name,
    contentType,
    sizeBytes: file.size,
    method: format,
    cvFileId,
    formatLabel: FORMAT_LABELS[format],
    storageBackend,
    storageWarning: storageOk
      ? null
      : "File storage is unavailable on this project — text was extracted for review, but the original file could not be saved.",
  });
}
