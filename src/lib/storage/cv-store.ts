import "server-only";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { connection } from "next/server";

/**
 * Original-file persistence for CV uploads.
 *
 * Firebase Cloud Storage is the preferred backend, but it requires the Blaze
 * plan. On projects without billing, files fall back to a Firestore-chunked
 * store: the binary is base64-split across sub-collection docs (well under
 * Firestore's 1 MB/document cap) with a meta doc written last as the commit
 * marker. Storage paths are backend-agnostic:
 *   gs://…            → Firebase Storage
 *   cvstore://{id}    → Firestore-chunked store
 */

const CVSTORE_PREFIX = "cvstore://";
const CHUNK_CHARS = 600_000; // base64 chars per doc (~450 KB binary, < 1 MB doc limit)

export type CvStoreMeta = {
  uid: string;
  docId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  extractedText: string;
  chunkCount: number;
};

export type LoadedCvFile = {
  buffer: Buffer;
  contentType: string;
  originalName: string;
};

export function isCvStorePath(path: string): boolean {
  return path.startsWith(CVSTORE_PREFIX);
}

export function cvStorePathFor(uid: string, docId: string): string {
  return `${CVSTORE_PREFIX}${uid}__${docId}`;
}

/** Persist an original CV file to the Firestore-chunked store. */
export async function saveCvOriginalFirestore(opts: {
  uid: string;
  docId: string;
  buffer: Buffer;
  contentType: string;
  originalName: string;
  extractedText: string;
}): Promise<string> {
  await connection();
  const { uid, docId, buffer, contentType, originalName, extractedText } = opts;
  const fileId = `${uid}__${docId}`;
  const base64 = buffer.toString("base64");
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  }

  const db = adminDb();
  const chunkRefs = chunks.map((_, i) =>
    db.doc(`cvOriginals/${fileId}/chunks/c${String(i).padStart(4, "0")}`),
  );
  for (let i = 0; i < chunkRefs.length; i += 400) {
    const batch = db.batch();
    chunkRefs.slice(i, i + 400).forEach((ref, j) => batch.set(ref, { data: chunks[i + j] }));
    await batch.commit();
  }

  const meta: CvStoreMeta = {
    uid,
    docId,
    originalName,
    contentType,
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString(),
    extractedText,
    chunkCount: chunks.length,
  };
  // Meta doc written last — its existence is the commit marker.
  await db.doc(`cvOriginals/${fileId}`).set(meta);
  return cvStorePathFor(uid, docId);
}

/** Load an original CV file from either backend. Returns null when missing. */
export async function loadCvOriginal(storagePath: string): Promise<LoadedCvFile | null> {
  await connection();
  const db = adminDb();

  if (isCvStorePath(storagePath)) {
    const fileId = storagePath.slice(CVSTORE_PREFIX.length);
    const metaSnap = await db.doc(`cvOriginals/${fileId}`).get();
    if (!metaSnap.exists) return null;
    const meta = metaSnap.data() as CvStoreMeta;
    const chunkSnap = await db.collection(`cvOriginals/${fileId}/chunks`).get();
    const parts = chunkSnap.docs
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((d) => (d.data().data as string) ?? "");
    if (parts.length !== meta.chunkCount) return null; // incomplete write
    return {
      buffer: Buffer.from(parts.join(""), "base64"),
      contentType: meta.contentType,
      originalName: meta.originalName,
    };
  }

  // gs:// or bare object path → Firebase Storage (requires billing; failures
  // surface to the route as a 404, never a fabricated success).
  try {
    const filePath = storagePath.replace(/^gs:\/\/[^/]+\//, "");
    const [buf] = await adminStorage().bucket().file(filePath).download();
    const [meta] = await adminStorage().bucket().file(filePath).getMetadata();
    return {
      buffer: buf,
      contentType: (meta.contentType as string) || "application/octet-stream",
      originalName: filePath.split("/").pop() ?? "cv-file",
    };
  } catch {
    return null;
  }
}

/** Remove a stored original (both backends). Best-effort; never throws. */
export async function deleteCvOriginal(storagePath: string): Promise<void> {
  try {
    if (isCvStorePath(storagePath)) {
      const fileId = storagePath.slice(CVSTORE_PREFIX.length);
      const db = adminDb();
      const chunks = await db.collection(`cvOriginals/${fileId}/chunks`).get();
      const batch = db.batch();
      chunks.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(db.doc(`cvOriginals/${fileId}`));
      await batch.commit();
      return;
    }
    const filePath = storagePath.replace(/^gs:\/\/[^/]+\//, "");
    await adminStorage().bucket().file(filePath).delete();
  } catch {
    /* best-effort */
  }
}
