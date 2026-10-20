import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted border-border",
  success: "bg-success-subtle text-success border-success/20",
  warning: "bg-warning-subtle text-warning border-warning/20",
  danger: "bg-danger-subtle text-danger border-danger/20",
  info: "bg-info-subtle text-info border-info/20",
  accent: "bg-accent-subtle text-accent border-accent/20",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.75rem] font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Status chip: colour is always paired with a text label. */
export function StatusChip({
  label,
  tone,
  className,
}: {
  label: string;
  tone: Tone;
  className?: string;
}) {
  return <Badge tone={tone} className={className}>{label}</Badge>;
}

/** Provenance chip for profile facts and generated document claims. */
export type Provenance = "verified" | "user-asserted" | "ai-preliminary" | "unknown";

const provenanceMeta: Record<Provenance, { label: string; tone: Tone }> = {
  verified: { label: "Verified", tone: "success" },
  "user-asserted": { label: "You confirmed", tone: "info" },
  "ai-preliminary": { label: "AI preliminary", tone: "warning" },
  unknown: { label: "Unknown", tone: "neutral" },
};

export function ProvenanceTag({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  const meta = provenanceMeta[provenance];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
