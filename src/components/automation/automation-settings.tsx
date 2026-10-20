"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch, FormField } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";

export function AutomationSettings({ profile }: { profile: CandidateProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [maxPerDay, setMaxPerDay] = React.useState(
    profile.automationPreferences.maxAutoSubmissionsPerDay,
  );
  const [autoApply, setAutoApply] = React.useState(profile.automationPreferences.autoApplyEnabled);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      const next = {
        ...profile,
        automationPreferences: {
          ...profile.automationPreferences,
          maxAutoSubmissionsPerDay: maxPerDay,
          autoApplyEnabled: autoApply,
        },
      };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      if (!res.ok) throw new Error("Save failed.");
      toast.push("Automation preferences saved.", "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3>Submission preferences</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <FormField
          label="Max submissions per day"
          htmlFor="max-per-day"
          hint="Caps the daily application budget. Manual applications also count against this quota."
        >
          <input
            id="max-per-day"
            type="number"
            min={0}
            max={50}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
            className="h-9 w-24 rounded-control border border-border-strong bg-surface px-3 text-[0.875rem] text-ink"
          />
        </FormField>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.875rem] font-medium text-ink">Auto-apply</p>
            <p className="text-[0.8125rem] text-ink-muted">
              Only works with supported API integrations. External-apply jobs are never auto-submitted.
            </p>
          </div>
          <Switch checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
        </div>
        <Button loading={busy} onClick={() => void save()}>
          Save preferences
        </Button>
      </CardBody>
    </Card>
  );
}
