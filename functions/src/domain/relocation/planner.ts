import { z } from "zod";

/**
 * Relocation planner — structured checklist and budget estimates.
 *
 * HONESTY RULES:
 * - Every checklist item is tagged `source` so the user knows whether it is a
 *   verified official requirement or general guidance.
 * - Cost figures are labelled "estimate" and carry a `disclaimer` when not
 *   sourced from an official fee schedule.
 * - Nothing here constitutes legal or immigration advice.
 */

export const checklistCategorySchema = z.enum([
  "permit",
  "documents",
  "housing",
  "finance",
  "healthcare",
  "arrival",
]);
export type ChecklistCategory = z.infer<typeof checklistCategorySchema>;

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  category: checklistCategorySchema,
  title: z.string().max(200),
  detail: z.string().max(1000).default(""),
  /** "official" = sourced from government site; "guidance" = general advice. */
  source: z.enum(["official", "guidance"]),
  /** Official URL when source = "official". */
  url: z.string().max(500).default(""),
  completed: z.boolean().default(false),
  completedAt: z.iso.datetime().nullable().default(null),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const relocationPlanSchema = z.object({
  uid: z.string().min(1),
  targetCountry: z.enum(["NL", "BE"]),
  items: z.array(checklistItemSchema).default([]),
  budgetEstimates: z
    .array(
      z.object({
        label: z.string().max(200),
        lowEur: z.number().int().min(0),
        highEur: z.number().int().min(0),
        note: z.string().max(500).default(""),
        source: z.enum(["official", "estimate"]),
      }),
    )
    .default([]),
  updatedAt: z.iso.datetime(),
});
export type RelocationPlan = z.infer<typeof relocationPlanSchema>;

const NL_DISCLAIMER =
  "General guidance only — not legal advice. Confirm every requirement with the IND (ind.nl) or your employer's immigration counsel before acting.";

const BE_DISCLAIMER =
  "General guidance only — not legal advice. Confirm every requirement with the Belgian regional employment service or your employer's immigration counsel before acting.";

/** Structured checklist per target country. Items marked official link to the authority. */
export function buildChecklist(targetCountry: "NL" | "BE"): ChecklistItem[] {
  if (targetCountry === "NL") {
    return [
      {
        id: "nl-ind-recognised-sponsor",
        category: "permit",
        title: "Confirm employer is an IND recognised sponsor",
        detail:
          "Search the recognised-sponsor list on ind.nl. Only recognised sponsors can sponsor a highly skilled migrant (kennismigrant) permit.",
        source: "official",
        url: "https://ind.nl/en/public-pages/recognised-sponsors",
        completed: false,
        completedAt: null,
      },
      {
        id: "nl-salary-threshold",
        category: "finance",
        title: "Verify salary meets the IND threshold for your age band",
        detail:
          "Gross monthly salary must meet or exceed the IND threshold (2026: €5,942 for 30+, €4,357 under 30). Confirm the current figure on ind.nl.",
        source: "official",
        url: "https://ind.nl/en/required-amounts-income-requirements",
        completed: false,
        completedAt: null,
      },
      {
        id: "nl-collect-docs",
        category: "documents",
        title: "Collect supporting documents",
        detail:
          "Passport, employment contract, diploma(s), and any prior Dutch residence documents. Get diplomas legalised/apostilled if required.",
        source: "guidance",
        url: "",
        completed: false,
        completedAt: null,
      },
      {
        id: "nl-municipality-reg",
        category: "arrival",
        title: "Register at the municipality (BRP) after arrival",
        detail:
          "Within 5 days of arrival, register at the Dutch municipality where you will live. You will receive a BSN (citizen service number).",
        source: "official",
        url: "https://www.government.nl/topics/burgerservicenumber",
        completed: false,
        completedAt: null,
      },
      {
        id: "nl-health-insurance",
        category: "healthcare",
        title: "Arrange Dutch health insurance",
        detail:
          "Basic health insurance (basisverzekering) is mandatory within 4 months of registration. Compare policies on vergelijkenzorgverzekeraars.nl.",
        source: "official",
        url: "https://www.government.nl/topics/health-insurance",
        completed: false,
        completedAt: null,
      },
      {
        id: "nl-housing",
        category: "housing",
        title: "Secure housing",
        detail:
          "The rental market in major cities is competitive. Start searching early; many landlords require a Dutch bank account and income proof.",
        source: "guidance",
        url: "",
        completed: false,
        completedAt: null,
      },
      {
        id: "nl-bank-account",
        category: "finance",
        title: "Open a Dutch bank account",
        detail:
          "Needed for salary payments, insurance, and rent. Many banks require a BSN and residence permit.",
        source: "guidance",
        url: "",
        completed: false,
        completedAt: null,
      },
    ];
  }
  // BE
  return [
    {
      id: "be-single-permit",
      category: "permit",
      title: "Confirm the single-permit route with your employer",
        detail:
        "Most third-country nationals need a single permit (work + residence). The employer initiates the application with the regional employment service.",
      source: "official",
      url: "https://www.belgium.be/en/work/entry_and_residence_for_non_eu_citizens/highly_skilled_workers",
      completed: false,
      completedAt: null,
    },
    {
      id: "be-salary-threshold",
      category: "finance",
      title: "Verify salary meets the regional threshold",
      detail:
        "Brussels highly-qualified threshold 2026: €3,703.44/month. Flanders and Wallonia use annual figures. Confirm with the regional employment service where the employer is based.",
      source: "official",
      url: "https://economy-employment.brussels/single-permit-minimum-remuneration",
      completed: false,
      completedAt: null,
    },
    {
      id: "be-collect-docs",
      category: "documents",
      title: "Collect supporting documents",
      detail:
        "Passport, employment contract (min. 1 year), diploma(s), and proof of professional experience. Diplomas may need legalisation.",
      source: "guidance",
      url: "",
      completed: false,
      completedAt: null,
    },
    {
      id: "be-municipality-reg",
      category: "arrival",
        title: "Register at the municipality (commune/gemeente) after arrival",
      detail:
        "Register at the local municipality within days of arrival to obtain a residence registration.",
      source: "official",
      url: "https://www.belgium.be/en/housing/registration",
      completed: false,
      completedAt: null,
    },
    {
      id: "be-health-insurance",
      category: "healthcare",
      title: "Register with a health insurance fund (mutualiteit)",
      detail:
        "Belgian health insurance is mandatory. Register with a mutualiteit (sickness fund) once registered.",
      source: "guidance",
      url: "",
      completed: false,
      completedAt: null,
    },
    {
      id: "be-housing",
      category: "housing",
      title: "Secure housing",
      detail:
        "Start searching early in Brussels, Antwerp, or Ghent. Many listings require a Belgian bank account and employment contract.",
      source: "guidance",
      url: "",
      completed: false,
      completedAt: null,
    },
    {
      id: "be-bank-account",
      category: "finance",
      title: "Open a Belgian bank account",
      detail:
        "Needed for salary, rent, and utilities. Some banks allow setup with passport and employment contract.",
      source: "guidance",
      url: "",
      completed: false,
      completedAt: null,
    },
  ];
}

/** Budget estimates — clearly labelled as estimates, not official fee schedules. */
export function buildBudgetEstimates(targetCountry: "NL" | "BE") {
  if (targetCountry === "NL") {
    return [
      { label: "IND residence permit application fee", lowEur: 300, highEur: 400, note: "Indicative — check ind.nl fees page for the current amount.", source: "estimate" as const },
      { label: "First month rent + deposit", lowEur: 1500, highEur: 4000, note: "Varies hugely by city; Amsterdam is at the top.", source: "estimate" as const },
      { label: "Health insurance (monthly)", lowEur: 120, highEur: 180, note: "Basic package (basisverzekering) estimate.", source: "estimate" as const },
      { label: "Flights from Lagos", lowEur: 300, highEur: 800, note: "One-way economy estimate.", source: "estimate" as const },
      { label: "Initial setup (furniture, bike, etc.)", lowEur: 500, highEur: 2000, note: "Optional; many rentals come partly furnished.", source: "estimate" as const },
    ];
  }
  return [
    { label: "Single permit application fee", lowEur: 200, highEur: 350, note: "Indicative — confirm with regional employment service.", source: "estimate" as const },
    { label: "First month rent + deposit", lowEur: 1200, highEur: 3500, note: "Varies by city; Brussels and Antwerp are higher.", source: "estimate" as const },
    { label: "Health insurance (monthly)", lowEur: 80, highEur: 150, note: "Mutualiteit contribution estimate.", source: "estimate" as const },
    { label: "Flights from Lagos", lowEur: 250, highEur: 700, note: "One-way economy estimate.", source: "estimate" as const },
    { label: "Initial setup", lowEur: 400, highEur: 1500, note: "Optional.", source: "estimate" as const },
  ];
}

export function getRelocationDisclaimer(targetCountry: "NL" | "BE"): string {
  return targetCountry === "NL" ? NL_DISCLAIMER : BE_DISCLAIMER;
}
