"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AiAnalysis =
  | {
      available: true;
      summary: string;
      matchReasons: string[];
      concerns: string[];
      salaryContext: string;
      model: string;
      totalTokens: number | null;
    }
  | { available: false; reason: string };

/**
 * AI analysis panel — calls POST /api/scout/jobs/{id}/ai-analysis.
 * When no AI provider is configured the API returns available:false and this
 * panel shows the reason. Nothing is ever fabricated.
 */
export function AiAnalysisPanel({ jobId }: { jobId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AiAnalysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scout/jobs/${encodeURIComponent(jobId)}/ai-analysis`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as AiAnalysis | { error?: { message?: string } } | null;
      if (!res.ok || !body || !("available" in body)) {
        const msg = (body as { error?: { message?: string } } | null)?.error?.message;
        throw new Error(msg ?? "AI analysis failed.");
      }
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3>AI analysis</h3>
          {result?.available && (
            <Badge tone="info">{result.model}</Badge>
          )}
        </div>
        <p className="text-[0.8125rem] text-ink-muted">
          Optional AI-assisted match analysis. Uses your verified profile facts only — nothing is
          invented. The deterministic score above is always available regardless of AI.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {!result && !error && (
          <Button loading={loading} onClick={() => void run()}>
            {loading ? "Analysing…" : "Run AI analysis"}
          </Button>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-[0.8125rem] text-danger">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void run()}>
              Retry
            </Button>
          </div>
        )}

        {result && !result.available && (
          <div className="space-y-2">
            <Badge tone="neutral">Not configured</Badge>
            <p className="text-[0.8125rem] text-ink-muted">{result.reason}</p>
            <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {result?.available && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[0.8125rem] font-medium">Summary</p>
              <p className="text-[0.875rem] leading-relaxed text-ink-muted">{result.summary}</p>
            </div>

            {result.matchReasons.length > 0 && (
              <div>
                <p className="mb-1 text-[0.8125rem] font-medium text-success">Match reasons</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {result.matchReasons.map((r, i) => (
                    <li key={i} className="text-[0.8125rem] text-ink-muted">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.concerns.length > 0 && (
              <div>
                <p className="mb-1 text-[0.8125rem] font-medium text-warning">Concerns</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {result.concerns.map((c, i) => (
                    <li key={i} className="text-[0.8125rem] text-ink-muted">{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.salaryContext && (
              <div>
                <p className="mb-1 text-[0.8125rem] font-medium">Salary context</p>
                <p className="text-[0.8125rem] text-ink-muted">{result.salaryContext}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-[0.75rem] text-ink-subtle">
              {result.totalTokens !== null && <span>{result.totalTokens} tokens</span>}
              <Button variant="ghost" size="sm" onClick={() => void run()}>
                Re-run
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
