import { z } from "zod";

/** users/{uid} document schema. */
export const userDocSchema = z.object({
  email: z.string().email(),
  displayName: z.string().default(""),
  timezone: z.string().default("Europe/Amsterdam"),
  onboardingCompleted: z.boolean().default(false),
  automationEnabled: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type UserDoc = z.infer<typeof userDocSchema>;
