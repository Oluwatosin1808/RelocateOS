import * as React from "react";
import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[1rem] font-semibold">{title}</h3>
        <p className="mx-auto max-w-md text-[0.875rem] text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  correlationId,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  correlationId?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[1rem] font-semibold">{title}</h3>
        <p className="mx-auto max-w-md text-[0.875rem] text-ink-muted">{description}</p>
        {correlationId && (
          <p className="data-font text-[0.75rem] text-ink-subtle">
            ref: {correlationId}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
