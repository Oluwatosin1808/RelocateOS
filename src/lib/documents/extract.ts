import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import { extractText, getDocumentProxy } from "unpdf";

export type CvFormat = "pdf" | "docx" | "doc" | "txt";

export type ExtractResult =
  | { ok: true; text: string; method: CvFormat }
  | { ok: false; error: string };

/** Detect CV format from MIME type and file name. Returns null when unsupported. */
export function detectCvFormat(contentType: string, fileName: string): CvFormat | null {
  const lower = fileName.toLowerCase();
  if (contentType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  // .docx before .doc (suffix overlap)
  if (contentType.includes("wordprocessingml") || lower.endsWith(".docx")) return "docx";
  if (contentType === "application/msword" || lower.endsWith(".doc")) return "doc";
  if (contentType.startsWith("text/") || lower.endsWith(".txt")) return "txt";
  return null;
}

/**
 * Extract plain text from a CV buffer. Pure extraction — no Storage, no profile
 * writes. Each format has its own parser; failures return `{ ok: false }` with
 * a user-safe message (never fabricates text).
 */
export async function extractCvText(buffer: Buffer, format: CvFormat): Promise<ExtractResult> {
  try {
    if (format === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      const text = (result.text ?? "").trim();
      if (!text) {
        return { ok: false, error: "No extractable text found. The PDF may be image-only." };
      }
      return { ok: true, text, method: "pdf" };
    }
    if (format === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) {
        return { ok: false, error: "No extractable text found in this .docx file." };
      }
      return { ok: true, text, method: "docx" };
    }
    if (format === "doc") {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      const text = doc.getBody().trim();
      if (!text) {
        return { ok: false, error: "No extractable text found in this .doc file." };
      }
      return { ok: true, text, method: "doc" };
    }
    // txt
    const text = buffer.toString("utf8").trim();
    if (!text) {
      return { ok: false, error: "The text file is empty." };
    }
    return { ok: true, text, method: "txt" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not read this file: ${detail}` };
  }
}
