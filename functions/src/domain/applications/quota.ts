import type { Application, ApplicationStatus } from "../schemas/application";

/**
 * Application quota logic — deterministic, day-bucketed, never fabricated.
 * The quota only gates *auto-submission*; manual "record external apply"
 * always counts against the same bucket so the user sees honest usage.
 */

/** UTC date bucket key (YYYY-MM-DD). */
export function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export type QuotaCheck = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  reason: string;
};

/**
 * Check whether one more submission is allowed today.
 * `used` and `limit` are both non-negative; used >= limit blocks.
 */
export function checkQuota(used: number, limit: number): QuotaCheck {
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    reason:
      used >= limit
        ? `Daily submission limit reached (${used}/${limit}). Resets at midnight UTC.`
        : `${remaining} submission${remaining === 1 ? "" : "s"} remaining today (${used}/${limit}).`,
  };
}

/** Valid application-status transitions. Enforced server-side. */
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["queued", "submitted", "external_confirmed", "withdrawn"],
  queued: ["submitted", "external_confirmed", "withdrawn"],
  submitted: ["in_review", "interview", "offer", "rejected", "withdrawn", "expired"],
  external_confirmed: ["in_review", "interview", "offer", "rejected", "withdrawn", "expired"],
  in_review: ["interview", "offer", "rejected", "withdrawn", "expired"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["withdrawn"],
  rejected: [],
  withdrawn: [],
  expired: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Human-readable label for each status (UI + notifications). */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  submitted: "Submitted",
  external_confirmed: "Applied (external)",
  in_review: "In review",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

/** Tone for Badge component pairing. */
export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, "neutral" | "success" | "warning" | "danger" | "info" | "accent"> = {
  draft: "neutral",
  queued: "info",
  submitted: "accent",
  external_confirmed: "accent",
  in_review: "info",
  interview: "info",
  offer: "success",
  rejected: "danger",
  withdrawn: "neutral",
  expired: "neutral",
};

/** Build the "already has an application for this job" lookup. */
export function findExistingApplication(
  applications: Application[],
  jobId: string,
): Application | undefined {
  return applications.find(
    (a) => a.jobId === jobId && !["withdrawn", "rejected", "expired"].includes(a.status),
  );
}
