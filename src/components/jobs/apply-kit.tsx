"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type Answer = { key: string; label: string; value: string; source: string };

/**
 * Application kit: one-click packet (CV + cover letter + answers + checklist),
 * copyable standard answers, and the local autofill-assist command. Nothing is
 * ever submitted to an employer from here — review and submit yourself.
 */
export function ApplyKit({
  jobId,
  answers,
  applyUrl,
}: {
  jobId: string;
  answers: Answer[];
  applyUrl: string;
}) {
  const toast = useToast();
  const packetHref = `/api/applications/packet?jobId=${encodeURIComponent(jobId)}`;
  const missing = answers.filter((a) => a.source === "missing");

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.push(`${label} copied.`, "success");
    } catch {
      toast.push("Could not copy — select the text manually.", "error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3>Application kit</h3>
        <p className="text-[0.8125rem] text-ink-muted">
          Tailored packet for this job: CV, cover letter, standard answers and a checklist.
          Review everything, submit on the employer site yourself, then record it below.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <a href={packetHref}>
            <Button variant="secondary">Download packet (ZIP)</Button>
          </a>
          {applyUrl && (
            <a href={applyUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost">Open employer page ↗</Button>
            </a>
          )}
        </div>

        {missing.length > 0 && (
          <p className="rounded-control border border-warning/40 bg-warning/10 p-3 text-[0.8125rem] text-ink">
            {missing.length} answer{missing.length === 1 ? "" : "s"} marked NOT ON PROFILE —
            complete them in Profile so every application is consistent.
          </p>
        )}

        <ul className="space-y-2">
          {answers.map((a) => (
            <li key={a.key} className="rounded-control border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.8125rem] font-medium text-ink">{a.label}</p>
                <button
                  type="button"
                  onClick={() => void copy(a.value, a.label)}
                  className="rounded-control border border-border px-2 py-1 text-[0.75rem] font-medium text-ink-muted hover:bg-surface-muted"
                >
                  Copy
                </button>
              </div>
              <p className="mt-1 text-[0.8125rem] whitespace-pre-wrap text-ink-muted">{a.value}</p>
              <p className="mt-1 text-[0.6875rem] text-ink-muted">source: {a.source}</p>
            </li>
          ))}
        </ul>

        <div className="rounded-control bg-surface-muted p-3">
          <p className="text-[0.8125rem] font-medium text-ink">Optional: local autofill assist</p>
          <p className="mt-1 text-[0.8125rem] text-ink-muted">
            On your machine, this opens the employer page in a real browser and fills the standard
            fields (name, email, uploads) — you answer custom questions and click Submit yourself.
          </p>
          <code className="mt-2 block rounded-control bg-surface p-2 text-[0.75rem] text-ink">
            npm run autofill -- {jobId}
          </code>
        </div>
      </CardBody>
    </Card>
  );
}
