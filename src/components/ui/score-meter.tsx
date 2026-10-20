import { cn } from "@/lib/utils/cn";

function scoreBand(score: number): { fg: string; label: string } {
  if (score >= 85) return { fg: "bg-success", label: "strong" };
  if (score >= 70) return { fg: "bg-info", label: "good" };
  if (score >= 50) return { fg: "bg-warning", label: "partial" };
  return { fg: "bg-ink-subtle", label: "weak" };
}

/**
 * Match score meter: 0–100 scale, numeric value always shown,
 * band colour paired with accessible aria-label.
 */
export function ScoreMeter({
  score,
  className,
  showValue = true,
}: {
  score: number | null | undefined;
  className?: string;
  showValue?: boolean;
}) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return (
      <span className={cn("text-[0.8125rem] text-ink-subtle", className)}>Not scored</span>
    );
  }
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const band = scoreBand(clamped);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showValue && (
        <span className="data-font text-[0.8125rem] font-semibold text-ink" aria-hidden="true">
          {clamped}
        </span>
      )}
      <span
        role="img"
        aria-label={`Match score ${clamped} out of 100, ${band.label}`}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted"
      >
        <span
          className={cn("block h-full rounded-full transition-[width] duration-300", band.fg)}
          style={{ width: `${clamped}%` }}
        />
      </span>
    </span>
  );
}
