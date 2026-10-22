"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormField, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";
import {
  mergeDraftIntoProfile,
  draftSectionCounts,
  CV_MERGE_SECTIONS,
  type CvMergeSection,
  type CvMergeSelections,
  type CvProfileDraft,
} from "@domain/profile/cv-draft";

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

type ParseResponse = {
  source: "ai" | "deterministic";
  aiReason: string | null;
  model: string | null;
  draft: CvProfileDraft;
  error?: { message?: string };
};

const SECTION_LABELS: Record<CvMergeSection, string> = {
  contact: "Contact details + portfolio links (fills empty fields only — your values win)",
  summary: "Professional summary",
  workExperience: "Work experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  projects: "Projects",
  certifications: "Certifications",
};

const EMPTY_SELECTIONS: CvMergeSelections = {
  contact: true, summary: true, workExperience: true, education: true,
  skills: true, languages: true, projects: true, certifications: true,
};

type MergeReport = {
  applied: Partial<Record<CvMergeSection, number>>;
  conflicts: string[];
  skipped: string[];
};

/**
 * CV import review: extracted text for the summary draft + one-click profile
 * autofill. The autofill parses the CV into a structured draft (AI when
 * configured, deterministic fallback otherwise), shows a per-section review,
 * and only writes `imported-pending-review` facts after the user confirms.
 */
export function CvImportReview({ profile }: { profile: CandidateProfile }) {
  const toast = useToast();
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [summaryDraft, setSummaryDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [parsing, setParsing] = React.useState(false);
  const [cvDraft, setCvDraft] = React.useState<CvProfileDraft | null>(null);
  const [parseMeta, setParseMeta] = React.useState<{ source: string; aiReason: string | null } | null>(null);
  const [selections, setSelections] = React.useState<CvMergeSelections>(EMPTY_SELECTIONS);
  const [applying, setApplying] = React.useState(false);
  const [report, setReport] = React.useState<MergeReport | null>(null);

  async function onPickFile(file: File) {
    setImporting(true);
    setResult(null);
    setCvDraft(null);
    setReport(null);
    setParseMeta(null);
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

  async function autofillFromCv() {
    if (!result) return;
    setParsing(true);
    try {
      const res = await fetch("/api/profile/cv-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.extractedText, cvFileId: result.cvFileId ?? undefined }),
      });
      const body = (await res.json().catch(() => null)) as ParseResponse | null;
      if (!res.ok || !body || !body.draft) {
        throw new Error(body?.error?.message ?? "Could not parse this CV.");
      }
      const counts = draftSectionCounts(body.draft);
      const nextSelections = { ...EMPTY_SELECTIONS };
      for (const key of CV_MERGE_SECTIONS) {
        nextSelections[key] = counts[key] > 0;
      }
      setCvDraft(body.draft);
      setSelections(nextSelections);
      setParseMeta({ source: body.source, aiReason: body.aiReason });
      toast.push(`Draft ready from ${body.source === "ai" ? "AI" : "deterministic"} extraction — review before applying.`, "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not parse this CV.", "error");
    } finally {
      setParsing(false);
    }
  }

  async function applyDraft() {
    if (!cvDraft) return;
    setApplying(true);
    try {
      const merged = mergeDraftIntoProfile(profile, cvDraft, selections);
      const appliedCount = Object.values(merged.applied).reduce((a, b) => a + (b ?? 0), 0);
      if (appliedCount === 0 && merged.conflicts.length === 0) {
        toast.push("Nothing new to apply — everything is already in your profile.", "info");
        setApplying(false);
        return;
      }
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: merged.profile }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Could not save profile.");
      }
      setReport({ applied: merged.applied, conflicts: merged.conflicts, skipped: merged.skipped });
      toast.push(`${appliedCount} fact${appliedCount === 1 ? "" : "s"} imported for review.`, "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save profile.", "error");
    } finally {
      setApplying(false);
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

  const counts = cvDraft ? draftSectionCounts(cvDraft) : null;
  const appliedTotal = report
    ? Object.values(report.applied).reduce((a, b) => a + (b ?? 0), 0)
    : 0;

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

        {result && !report && (
          <div className="space-y-3 rounded-control border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{result.formatLabel}</Badge>
              <span className="text-[0.8125rem] text-ink-muted">
                {result.originalName} · {result.originalChars.toLocaleString("en-GB")} characters
                {result.truncated ? " (preview truncated)" : ""}
              </span>
              {result.cvFileId && !result.storageWarning && (
                <Badge tone="success">Original file stored</Badge>
              )}
            </div>
            {result.storageWarning && (
              <p className="text-[0.8125rem] text-warning">{result.storageWarning}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={parsing}
                onClick={() => void autofillFromCv()}
                disabled={Boolean(cvDraft)}
              >
                Autofill profile from this CV
              </Button>
              <span className="self-center text-[0.8125rem] text-ink-muted">
                Parses contact, experience, education and skills into a reviewable draft.
              </span>
            </div>

            {parseMeta && (
              <p className="text-[0.8125rem] text-ink-muted">
                Extraction:{" "}
                <strong>{parseMeta.source === "ai" ? "AI-assisted" : "deterministic"}</strong>
                {parseMeta.aiReason ? ` — ${parseMeta.aiReason}` : ""}
              </p>
            )}

            {cvDraft && counts && (
              <div className="space-y-3 rounded-control border border-border p-4">
                <p className="text-[0.875rem] font-medium text-ink">
                  Profile autofill draft — choose what to apply
                </p>
                <p className="text-[0.8125rem] text-ink-muted">
                  Imported facts are marked &quot;pending review&quot; in your profile. Existing
                  values are never overwritten.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CV_MERGE_SECTIONS.map((section) => {
                    const n = counts[section];
                    return (
                      <label
                        key={section}
                        className={`flex items-start gap-2 rounded-control border border-border p-2 text-[0.8125rem] ${n === 0 ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          disabled={n === 0}
                          checked={selections[section] && n > 0}
                          onChange={(e) =>
                            setSelections((prev) => ({ ...prev, [section]: e.target.checked }))
                          }
                        />
                        <span className="text-ink">
                          {SECTION_LABELS[section]}{" "}
                          <span className="text-ink-muted">({n})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button loading={applying} onClick={() => void applyDraft()}>
                    Apply selected to profile
                  </Button>
                  <Button variant="ghost" onClick={() => setCvDraft(null)}>
                    Cancel draft
                  </Button>
                </div>
              </div>
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
              <Button variant="ghost" onClick={() => { setResult(null); setCvDraft(null); setParseMeta(null); }}>
                Discard
              </Button>
            </div>
          </div>
        )}

        {report && (
          <div className="space-y-3 rounded-control border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Applied</Badge>
              <span className="text-[0.8125rem] text-ink-muted">
                {appliedTotal} new fact{appliedTotal === 1 ? "" : "s"} saved as pending review —
                edit or confirm them in the Profile editor.
              </span>
            </div>
            {report.conflicts.length > 0 && (
              <div className="text-[0.8125rem] text-ink">
                <p className="font-medium">Kept your existing values:</p>
                <ul className="list-inside list-disc text-ink-muted">
                  {report.conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.skipped.length > 0 && (
              <div className="text-[0.8125rem] text-ink">
                <p className="font-medium">Skipped (not parsable — add manually if needed):</p>
                <ul className="list-inside list-disc text-ink-muted">
                  {report.skipped.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => { setReport(null); setResult(null); setCvDraft(null); setParseMeta(null); }}
            >
              Done
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
