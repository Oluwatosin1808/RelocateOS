import { getCurrentUserDoc } from "@/lib/auth/dal";
import { Badge } from "@/components/ui/badge";

/** Server component: reads the session; must be rendered inside <Suspense>. */
export async function Topbar() {
  const { doc } = await getCurrentUserDoc();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur md:px-6">
      <div className="min-w-0 pl-10 md:pl-0">
        <p className="truncate text-[0.8125rem] font-medium text-ink">
          {doc.displayName || doc.email}
        </p>
        <p className="eyebrow">Personal workspace · {doc.timezone}</p>
      </div>
      <div className="flex items-center gap-2">
        {!doc.automationEnabled && (
          <Badge tone="warning">Automation off</Badge>
        )}
        {doc.onboardingCompleted ? (
          <Badge tone="success">Setup complete</Badge>
        ) : (
          <Badge tone="info">Setup pending</Badge>
        )}
      </div>
    </header>
  );
}

export function TopbarFallback() {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-surface/95 px-4 md:px-6" />
  );
}
