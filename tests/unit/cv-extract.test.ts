import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectCvFormat, extractCvText } from "@/lib/documents/extract";

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures");

describe("detectCvFormat", () => {
  it("detects PDF by MIME", () => {
    expect(detectCvFormat("application/pdf", "cv.pdf")).toBe("pdf");
  });
  it("detects PDF by extension", () => {
    expect(detectCvFormat("application/octet-stream", "CV.PDF")).toBe("pdf");
  });
  it("detects DOCX by MIME", () => {
    expect(
      detectCvFormat(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "cv.docx",
      ),
    ).toBe("docx");
  });
  it("detects DOCX by extension", () => {
    expect(detectCvFormat("application/octet-stream", "cv.docx")).toBe("docx");
  });
  it("detects legacy DOC by MIME", () => {
    expect(detectCvFormat("application/msword", "cv.doc")).toBe("doc");
  });
  it("detects legacy DOC by extension", () => {
    expect(detectCvFormat("application/octet-stream", "cv.doc")).toBe("doc");
  });
  it(".docx is not confused with .doc", () => {
    expect(detectCvFormat("application/octet-stream", "my.docx")).toBe("docx");
  });
  it("detects TXT by MIME", () => {
    expect(detectCvFormat("text/plain", "cv.txt")).toBe("txt");
  });
  it("detects TXT by extension", () => {
    expect(detectCvFormat("application/octet-stream", "cv.txt")).toBe("txt");
  });
  it("returns null for unsupported types", () => {
    expect(detectCvFormat("image/png", "cv.png")).toBeNull();
    expect(detectCvFormat("application/zip", "cv.zip")).toBeNull();
    expect(detectCvFormat("application/octet-stream", "cv.exe")).toBeNull();
  });
});

describe("extractCvText — txt", () => {
  it("extracts UTF-8 text", async () => {
    const buf = Buffer.from("John Doe\nSenior Engineer", "utf8");
    const r = await extractCvText(buf, "txt");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe("John Doe\nSenior Engineer");
      expect(r.method).toBe("txt");
    }
  });
  it("returns error for empty text", async () => {
    const r = await extractCvText(Buffer.from("", "utf8"), "txt");
    expect(r.ok).toBe(false);
  });
});

describe("extractCvText — legacy .doc", () => {
  it("extracts text from a real .doc file", async () => {
    const buf = readFileSync(join(FIXTURE_DIR, "test-cv.doc"));
    const r = await extractCvText(buf, "doc");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("John Doe");
      expect(r.text).toContain("Senior Software Engineer");
      expect(r.method).toBe("doc");
    }
  }, 15_000);

  it("returns error for a corrupt .doc (OLE2 header only)", async () => {
    const fake = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const r = await extractCvText(fake, "doc");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Could not read");
    }
  }, 15_000);
});

describe("extractCvText — docx", () => {
  it("returns error for a non-docx buffer", async () => {
    const fake = Buffer.from("not a docx at all");
    const r = await extractCvText(fake, "docx");
    expect(r.ok).toBe(false);
  }, 15_000);
});

describe("extractCvText — pdf", () => {
  it("returns error for a non-pdf buffer", async () => {
    const fake = Buffer.from("not a pdf");
    const r = await extractCvText(fake, "pdf");
    expect(r.ok).toBe(false);
  }, 15_000);
});
