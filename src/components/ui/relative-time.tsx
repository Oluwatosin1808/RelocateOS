"use client";

import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";

function subscribe(callback: () => void): () => void {
  window.addEventListener("pageshow", callback);
  return () => window.removeEventListener("pageshow", callback);
}

/** True after hydration; false during SSR/prerender. */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** Renders a relative timestamp with an absolute ISO tooltip. */
export function RelativeTime({
  value,
  className,
}: {
  value: string | Date | null | undefined;
  className?: string;
}) {
  const hydrated = useHydrated();

  if (!value) return <span className={className}>—</span>;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return <span className={className}>—</span>;

  const absolute = date.toISOString();
  return (
    <time dateTime={absolute} title={absolute} className={className}>
      {hydrated ? formatDistanceToNowStrict(date, { addSuffix: true }) : absolute.slice(0, 10)}
    </time>
  );
}
