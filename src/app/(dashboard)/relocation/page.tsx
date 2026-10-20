import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { loadCandidateProfile } from "@/lib/profile/dal";
import { buildChecklist, buildBudgetEstimates, getRelocationDisclaimer } from "@domain/relocation/planner";
import { Card, CardBody, CardHeader, SectionHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RelocationPlanner } from "@/components/relocation/relocation-planner";

export const metadata = { title: "Relocation Planner" };

export default function Page() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Relocation"
        title="Relocation Planner"
        description="Permit research, documents, housing and budget — general guidance kept clearly separate from verified legal requirements."
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
  const targetCountry = profile?.relocationPreferences.targetCountries[0] ?? "NL";

  const items = buildChecklist(targetCountry);
  const budget = buildBudgetEstimates(targetCountry);
  const disclaimer = getRelocationDisclaimer(targetCountry);

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <Card>
        <CardBody>
          <Badge tone="warning">Guidance only — not legal advice</Badge>
          <p className="mt-2 text-[0.8125rem] text-ink-muted">{disclaimer}</p>
        </CardBody>
      </Card>

      <RelocationPlanner
        country={targetCountry}
        initialItems={items}
        budget={budget}
      />
    </div>
  );
}
