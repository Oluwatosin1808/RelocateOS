"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormField, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";

type ImportResult = {
  extractedText: string;
  truncated: boolean;
  originalChars: number;
  storagePath: string;
  originalStoragePath: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  method: string;
  cvFileId: string | null;
  formatLabel: string;
  storageWarning: string | null;
};

/**
 * CV import review: extracted text is shown for confirmation. The user decides
 * what (if anything) lands in the profile summary — the system never auto-fills.
 */
export function CvImportReview({ profile }: { profile: CandidateProfile }) {
  const toast = useToast();
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [summaryDraft, setSummaryDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function onPickFile(file: File) {
    setImporting(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/cv-import", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as
        | (ImportResult & { error?: { message?: string } })
        | null;
      if (!res.ok || !body || !("extractedText" in body)) {
        throw new Error(body?.error?.message ?? "Import failed.");
      }
      setResult(body);
      setSummaryDraft((prev) => prev || body.extractedText.slice(0, 400));
      toast.push("Text extracted. Review before saving anything.", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Import failed.", "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmSummary() {
    setSaving(true);
    try {
      const next = {
        ...profile,
        professionalSummary: summaryDraft.slice(0, 2000),
        lastVerifiedAt: new Date().toISOString(),
      };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      if (!res.ok) throw new Error("Could not save summary.");
      toast.push("Summary saved as a user-confirmed fact.", "success");
      setResult(null);
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3>Import CV</h3>
        <p className="text-[0.8125rem] text-ink-muted">
          Upload a .pdf, .doc, .docx, or .txt CV. Text is extracted for your review — nothing
          enters the profile until you confirm it.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            aria-label="CV file"
            className="block w-full text-[0.8125rem] text-ink-muted file:mr-3 file:rounded-control file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
            }}
          />
          {importing && (
            <p className="mt-2 text-[0.8125rem] text-ink-muted" aria-busy="true">
              Extracting text…
            </p>
          )}
        </div>

        {result && (
          <div className="space-y-3 rounded-control border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{result.formatLabel}</Badge>
              <span className="text-[0.8125rem] text-ink-muted">
                {result.originalName} · {result.originalChars.toLocaleString("en-GB")} characters
                {result.truncated ? " (preview truncated)" : ""}
              </span>
            </div>
            {result.storageWarning && (
              <p className="text-[0.8125rem] text-warning">{result.storageWarning}</p>
            )}
            <FormField
              label="Proposed professional summary (edit before saving)"
              htmlFor="summaryDraft"
              hint="Suggested as the first ~400 characters of extracted text. Change anything that is wrong."
            >
              <Textarea
                id="summaryDraft"
                rows={6}
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
              />
            </FormField>
            <pre className="max-h-64 overflow-auto rounded-control bg-surface-muted p-3 text-[0.75rem] whitespace-pre-wrap text-ink-muted">
              {result.extractedText.slice(0, 3000)}
            </pre>
            <div className="flex gap-2">
              <Button onClick={() => void confirmSummary()} loading={saving}>
                Save as professional summary
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
