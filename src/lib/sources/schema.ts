import { z } from "zod";
import { jobSourceSchema } from "@domain/schemas/job";

export const sourceCreateSchema = z.object({
  provider: z.enum(["greenhouse", "lever"]),
  displayName: z.string().min(1).max(160),
  configuration: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true),
});
export type SourceCreateInput = z.infer<typeof sourceCreateSchema>;

export const sourceUpdateSchema = z.object({
  displayName: z.string().min(1).max(160).optional(),
  enabled: z.boolean().optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});
export type SourceUpdateInput = z.infer<typeof sourceUpdateSchema>;

export function buildSourceId(provider: string, config: Record<string, unknown>): string {
  const key =
    provider === "greenhouse"
      ? String(config.boardToken ?? "")
      : provider === "lever"
        ? String(config.company ?? "")
        : "";
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${provider}__${slug || "unnamed"}`;
}

/** Search-only capabilities for public job-board adapters (never claim submission). */
export function searchOnlyCapabilities() {
  return {
    searchJobs: true,
    fetchJobDetails: false,
    verifyEmployer: false,
    submitApplications: false,
    checkApplicationStatus: false,
  };
}

export { jobSourceSchema };
