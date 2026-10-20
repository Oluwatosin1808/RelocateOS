import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { getServerEnv, describeServerCapabilities } from "@/lib/configuration/env";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SourcesPanel } from "@/components/jobs/sources-panel";
import { AutomationSettings } from "@/components/automation/automation-settings";

export const metadata = { title: "Automation" };

export default function Page() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Operations"
        title="Automation"
        description="Job sources, scheduler health, submission quota and capability flags."
      />
      <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { user } = await requireOnboardedUser();
  const profile = await loadCandidateProfile(user.uid);
  const env = getServerEnv();
  const capabilities = describeServerCapabilities(env);

  return (
    <div className="space-y-6">
      {/* Capability flags — honest about what is and isn't wired */}
      <Card>
        <CardHeader>
          <h3>Capabilities</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <CapabilityRow
            label="AI analysis"
            configured={capabilities.ai.configured}
            detail={
              capabilities.ai.provider === "none"
                ? "No AI key configured — deterministic rule-based analysis is used and labelled as such. Set AI_PROVIDER=openai-compatible + AI_API_KEY in .env.local (Gemini, Groq, OpenAI, Ollama all supported)."
                : `Provider: ${env.ai.provider}${env.ai.model ? ` · Model: ${env.ai.model}` : ""}`
            }
          />
          <CapabilityRow
            label="Email notifications"
            configured={capabilities.email.configured}
            detail={
              capabilities.email.provider === "none"
                ? "No email provider — notifications are stored but not delivered. Set EMAIL_PROVIDER=resend and EMAIL_API_KEY in .env.local to enable."
                : `Provider: ${env.email.provider}${env.email.fromAddress ? ` · From: ${env.email.fromAddress}` : ""}`
            }
          />
          <CapabilityRow
            label="Greenhouse sources"
            configured={capabilities.sources.greenhouse}
            detail={capabilities.sources.greenhouse ? "Enabled" : "Disabled"}
          />
          <CapabilityRow
            label="Lever sources"
            configured={capabilities.sources.lever}
            detail={
              capabilities.sources.lever
                ? "Enabled (health checks may report failure — Lever public API availability varies)"
                : "Disabled"
            }
          />
          <CapabilityRow
            label="Scheduled scan"
            configured={true}
            detail="Cloud Function runs every 6 hours (deployed via `firebase deploy --only functions`)."
          />
        </CardBody>
      </Card>

      {/* Automation preferences */}
      {profile && <AutomationSettings profile={profile} />}

      {/* Job sources */}
      <Card>
        <CardHeader>
          <h3>Job sources</h3>
        </CardHeader>
        <CardBody>
          <SourcesPanel />
        </CardBody>
      </Card>
    </div>
  );
}

function CapabilityRow({
  label,
  configured,
  detail,
}: {
  label: string;
  configured: boolean;
  detail: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-control border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium text-ink">{label}</p>
        <p className="text-[0.8125rem] text-ink-muted">{detail}</p>
      </div>
      <Badge tone={configured ? "success" : "neutral"}>{configured ? "Active" : "Not configured"}</Badge>
    </div>
  );
}
