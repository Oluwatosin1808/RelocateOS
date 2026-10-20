"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type Pathway = {
  id: string;
  name: string;
  summary: string;
  fit: "likely" | "possible" | "unlikely" | "unknown";
  notes: string;
};

type Assessment = {
  targetCountry: "NL" | "BE";
  authorisationStatus: string;
  preliminaryIndicator: "eligible_to_work" | "may_need_sponsorship" | "needs_sponsorship" | "unknown";
  pathways: Pathway[];
  salaryThresholdCheck?: {
    applicable: boolean;
    thresholdEur: number | null;
    offeredEur: number | null;
    meetsThreshold: boolean | null;
    note: string;
  };
  disclaimer: string;
  assessedAt: string;
};

const fitTone: Record<Pathway["fit"], "success" | "warning" | "danger" | "neutral"> = {
  likely: "success",
  possible: "warning",
  unlikely: "danger",
  unknown: "neutral",
};

const indicatorLabel: Record<Assessment["preliminaryIndicator"], string> = {
  eligible_to_work: "May already be eligible to work",
  may_need_sponsorship: "May need sponsorship",
  needs_sponsorship: "Needs employer sponsorship",
  unknown: "Status unclear — update your profile",
};

export function SponsorshipAssessmentPanel() {
  const toast = useToast();
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/immigration/assessment");
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string }; assessments?: Assessment[] }
        | null;
      if (!res.ok || !body?.assessments) {
        throw new Error(body?.error?.message ?? "Could not load assessment.");
      }
      setAssessments(body.assessments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assessment.");
      toast.push(error ?? "Could not load assessment.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Sponsorship pathways</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Preliminary rule-based indicator from your profile and publicly known structural
            categories. NOT legal advice. Always confirm with IND / the regional employment
            service or the employer&apos;s immigration counsel.
          </p>
        </div>
        <Button size="sm" loading={loading} onClick={() => void load()}>
          {assessments ? "Re-assess" : "Assess pathways"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-5">
        {error && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        {assessments === null && !error && (
          <p className="text-[0.875rem] text-ink-muted">
            Click &quot;Assess pathways&quot; to see a preliminary indicator for each of your target
            countries.
          </p>
        )}
        {assessments?.map((a) => (
          <div key={a.targetCountry} className="space-y-3 rounded-control border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{a.targetCountry === "NL" ? "Netherlands" : "Belgium"}</Badge>
              <Badge
                tone={
                  a.preliminaryIndicator === "eligible_to_work"
                    ? "success"
                    : a.preliminaryIndicator === "unknown"
                      ? "neutral"
                      : "warning"
                }
              >
                {indicatorLabel[a.preliminaryIndicator]}
              </Badge>
              <span className="text-[0.75rem] text-ink-subtle">
                status: {a.authorisationStatus}
              </span>
            </div>
            {a.salaryThresholdCheck && (
              <div className="rounded-control bg-surface-muted p-3 text-[0.8125rem]">
                <p className="font-medium">Salary threshold (indicative)</p>
                <p className="text-ink-muted">
                  Threshold ~€
                  {a.salaryThresholdCheck.thresholdEur?.toLocaleString("en-GB") ?? "?"}/mo ·{" "}
                  {a.salaryThresholdCheck.offeredEur != null
                    ? `your floor €${a.salaryThresholdCheck.offeredEur.toLocaleString("en-GB")}/mo · ${
                        a.salaryThresholdCheck.meetsThreshold
                          ? "meets indicative threshold"
                          : "below indicative threshold"
                      }`
                    : "salary not disclosed"}
                </p>
                <p className="mt-1 text-[0.75rem] text-ink-subtle">{a.salaryThresholdCheck.note}</p>
              </div>
            )}
            <ul className="space-y-2">
              {a.pathways.map((p) => (
                <li key={p.id} className="rounded-control border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.875rem] font-medium">{p.name}</span>
                    <Badge tone={fitTone[p.fit]}>{p.fit}</Badge>
                  </div>
                  <p className="mt-1 text-[0.8125rem] text-ink-muted">{p.summary}</p>
                  <p className="mt-1 text-[0.75rem] text-ink-subtle">{p.notes}</p>
                </li>
              ))}
            </ul>
            <p className="text-[0.75rem] text-ink-subtle italic">{a.disclaimer}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
