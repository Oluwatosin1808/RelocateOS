import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { Card, CardBody, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-card bg-surface-muted" />}>
      <PageContent />
    </Suspense>
  );
}

async function PageContent() {
  await requireOnboardedUser();
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Documents"
        title="Documents"
        description="Tailored CVs and cover letters grounded in your verified profile, with claim-level provenance."
      />
      <Card>
        <CardBody>
          <EmptyState
            title="Coming in the next build phase"
            description="This section is part of the phased implementation. It will light up as soon as its backend is wired."
          />
        </CardBody>
      </Card>
    </div>
  );
}
