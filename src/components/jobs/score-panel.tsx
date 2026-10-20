"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreMeter } from "@/components/ui/score-meter";
import { useToast } from "@/components/ui/toast";

type ScoreComponent = {
  key: string;
  label: string;
  score: number;
  max: number;
  detail: string;
};

type ScoreDoc = {
  jobId: string;
  total: number;
  components: ScoreComponent[];
  scoredAt: string;
};

export function ScorePanel({ jobId, initialScore }: { jobId: string; initialScore: ScoreDoc | null }) {
  const toast = useToast();
  const router = useRouter();
  const [score, setScore] = React.useState<ScoreDoc | null>(initialScore);
  const [busy, setBusy] = React.useState(false);

  async function computeScore() {
    setBusy(true);
    try {
      const res = await fetch(`/api/scout/jobs/${encodeURIComponent(jobId)}/score`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string }; score?: { total: number; components: ScoreComponent[]; scoredAt: string } }
        | null;
      if (!res.ok || !body?.score) {
        throw new Error(body?.error?.message ?? "Could not score this job.");
      }
      setScore({
        jobId,
        total: body.score.total,
        components: body.score.components,
        scoredAt: body.score.scoredAt,
      });
      toast.push(`Scored ${body.score.total}/100.`, "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not score.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Match score</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Deterministic breakdown against your confirmed profile. Not AI guesswork.
          </p>
        </div>
        <Button size="sm" loading={busy} onClick={() => void computeScore()}>
          {score ? "Re-score" : "Score this job"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        {score ? (
          <>
            <div className="flex items-center gap-3">
              <span className="data-font text-[2rem] font-semibold leading-none">{score.total}</span>
              <ScoreMeter score={score.total} showValue={false} />
              <Badge tone={score.total >= 70 ? "success" : score.total >= 50 ? "warning" : "neutral"}>
                {score.total >= 70 ? "Strong" : score.total >= 50 ? "Partial" : "Weak"}
              </Badge>
            </div>
            <ul className="space-y-3">
              {score.components.map((c) => (
                <li key={c.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[0.8125rem]">
                    <span className="font-medium">{c.label}</span>
                    <span className="data-font text-ink-muted">
                      {c.score}/{c.max}
                    </span>
                  </div>
                  <ScoreMeter score={Math.round((c.score / Math.max(c.max, 1)) * 100)} showValue={false} />
                  <p className="text-[0.75rem] text-ink-muted">{c.detail}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[0.875rem] text-ink-muted">
            Not scored yet. Click &quot;Score this job&quot; to compute a breakdown against your profile.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
