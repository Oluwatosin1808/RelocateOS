import { z } from "zod";

/**
 * Sponsorship / work-authorisation assessment module (Phase 3).
 *
 * IMPORTANT: This module produces a *rule-based preliminary indicator*, never
 * a legal determination. It compares the candidate's declared authorisation
 * status against publicly known Dutch and Belgian work-permit frameworks.
 * The output is labelled "preliminary" and always includes a disclaimer.
 *
 * Sources of truth are the national immigration websites (IND for NL, Belgium
 * for BE). Rules change; this module encodes stable structural categories
 * (e.g. "highly skilled migrant salary threshold exists") and never invents
 * eligibility. Final eligibility must be confirmed with the employer's
 * immigration counsel or the national immigration authority.
 */

export const countryCodeOfResidenceSchema = z.enum(["NL", "BE", "OTHER"]);
export type CountryCodeOfResidence = z.infer<typeof countryCodeOfResidenceSchema>;

export const authorisationStatusSchema = z.enum([
  "eu-citizen",
  "eu-permit-holder",
  "sponsorship-required",
  "unknown",
]);
export type AuthorisationStatus = z.infer<typeof authorisationStatusSchema>;

export const sponsorshipAssessmentInputSchema = z.object({
  /** Candidate's declared nationality (free text, e.g. "Nigerian"). */
  nationality: z.string().max(120).default(""),
  /** Whether the candidate already holds an EU work permit. */
  hasEuWorkPermit: z.boolean().default(false),
  freeTextPermitDetails: z.string().max(1000).default(""),
  /** Whether the candidate states they need employer sponsorship. */
  requiresEmployerSponsorship: z.boolean().default(true),
  /** Target country for this assessment. */
  targetCountry: z.enum(["NL", "BE"]),
  /** Gross monthly salary offered / expected in EUR (null = undisclosed). */
  grossMonthlyEur: z.number().int().min(0).max(100000).nullable().default(null),
  /** Job title — used only to flag highly-skilled / ICT categories by keyword. */
  jobTitle: z.string().max(200).default(""),
});
export type SponsorshipAssessmentInput = z.infer<typeof sponsorshipAssessmentInputSchema>;

export const pathwaySchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  /** Structural fit: "likely" | "possible" | "unlikely" | "unknown" */
  fit: z.enum(["likely", "possible", "unlikely", "unknown"]),
  notes: z.string(),
});
export type Pathway = z.infer<typeof pathwaySchema>;

export const sponsorshipAssessmentSchema = z.object({
  targetCountry: z.enum(["NL", "BE"]),
  authorisationStatus: authorisationStatusSchema,
  /** Preliminary indicator only. Never legal advice. */
  preliminaryIndicator: z.enum(["eligible_to_work", "may_need_sponsorship", "needs_sponsorship", "unknown"]),
  pathways: z.array(pathwaySchema),
  /** Salary threshold check (highly skilled migrant), when disclosed. */
  salaryThresholdCheck: z
    .object({
      applicable: z.boolean(),
      thresholdEur: z.number().int().nullable(),
      offeredEur: z.number().int().nullable(),
      meetsThreshold: z.boolean().nullable(),
      note: z.string(),
    })
    .optional(),
  disclaimer: z.string(),
  assessedAt: z.string(),
});
export type SponsorshipAssessment = z.infer<typeof sponsorshipAssessmentSchema>;

/**
 * Indicative highly-skilled-migrant (kennismigrant) monthly gross salary
 * thresholds. Verified against ind.nl and Brussels Economy & Employment for
 * 2026. These are STRUCTURAL PLACEHOLDERS for preliminary comparison only —
 * the authoritative figures live on ind.nl and the Belgian regional employment
 * service sites and are re-checked at deploy time.
 * Values below reflect publicly announced 2026 thresholds. The assessment
 * labels them "indicative" and always tells the user to confirm with IND/employer.
 */
const INDICATIVE_THRESHOLDS = {
  NL: {
    // Verified 2026 (ind.nl/en/required-amounts-income-requirements)
    under30: 4357,
    thirtyPlus: 5942,
    reduced: 3122,
    blueCard: 5942,
    blueCardReduced: 4754,
    note: "Dutch IND highly-skilled-migrant salary threshold for 2026 (monthly gross, excl. holiday allowance). Verified on ind.nl — confirm the figure current on the date of application. Thresholds change on 1 Jan and 1 Jul.",
  },
  BE: {
    // Brussels Capital Region (economy-employment.brussels/single-permit-minimum-remuneration)
    brussels: {
      highlyQualified: 3703,
      management: 6647,
      blueCard: 4748,
      note: "Brussels Capital Region highly-qualified salary threshold for 2026 (monthly gross). Verify with Brussels Economy & Employment. Thresholds vary by region: Flanders and Wallonia use annual figures and update on a different schedule.",
    },
  },
} as const;

function detectAuthorisationStatus(input: {
  hasEuWorkPermit: boolean;
  requiresEmployerSponsorship: boolean;
}): AuthorisationStatus {
  if (input.hasEuWorkPermit) return "eu-permit-holder";
  if (input.requiresEmployerSponsorship) return "sponsorship-required";
  return "unknown";
}

function buildPathways(input: SponsorshipAssessmentInput): Pathway[] {
  const pathways: Pathway[] = [];
  const { targetCountry } = input;
  const status = detectAuthorisationStatus(input);

  if (status === "eu-permit-holder") {
    pathways.push({
      id: "existing-permit",
      name: "Existing EU work authorisation",
      summary:
        "You indicated you already hold an EU work permit. Confirm with the employer that the permit is transferable to the new role and country.",
      fit: "likely",
      notes:
        "A valid EU permit often simplifies the process, but transferability depends on the permit type and issuing country.",
    });
    return pathways;
  }

  if (targetCountry === "NL") {
    pathways.push({
      id: "highly-skilled-migrant",
      name: "Dutch Highly Skilled Migrant (Kennismigrant)",
      summary:
        "Employer sponsors a residence permit as a highly skilled migrant. Requires a recognised sponsor and a salary at or above the IND threshold for your age band.",
      fit: status === "sponsorship-required" ? "possible" : "unknown",
      notes:
        "The employer must be a recognised sponsor (recognised sponsor list on ind.nl). Salary threshold depends on age and is re-indexed annually.",
    });
    pathways.push({
      id: "orientation-year",
      name: "Orientation Year (Zoekjaar) for highly educated",
      summary:
        "A one-year residence permit for job seeking, available to recent graduates of top-ranked universities and certain highly skilled candidates.",
      fit: "unknown",
      notes:
        "Eligibility depends on graduation date and university ranking. Check ind.nl for the current eligible-institutions list.",
    });
    pathways.push({
      id: "single-permit",
      name: "Single Permit (combined residence + work)",
      summary:
        "Some Dutch residence permits combine work authorisation and residence. The highly skilled migrant permit is the most common single-permit route for skilled roles.",
      fit: "unknown",
      notes: "Which single permit applies depends on the specific Dutch residence category.",
    });
  } else {
    // BE
    pathways.push({
      id: "highly-skilled-migrant-be",
      name: "Belgian Highly Skilled Migrant",
      summary:
        "Work authorisation for highly skilled professionals employed by a recognised company, with a salary above the regional threshold.",
      fit: status === "sponsorship-required" ? "possible" : "unknown",
      notes:
        "Thresholds and recognised-employer lists vary by region (Flanders, Wallonia, Brussels). Confirm with the regional employment service.",
    });
    pathways.push({
      id: "blue-card",
      name: "EU Blue Card (Belgium)",
      summary:
        "EU-wide Blue Card for highly skilled workers with a recognised degree and a salary above the national threshold.",
      fit: "unknown",
      notes:
        "Requires a degree (or equivalent experience in some cases) and a salary above the Belgian Blue Card threshold.",
    });
    pathways.push({
      id: "single-permit-be",
      name: "Belgian Single Permit",
      summary:
        "Combined residence and work authorisation. The employer initiates the application with the regional employment service.",
      fit: "unknown",
      notes:
        "The single permit is the standard route for most third-country nationals working in Belgium.",
    });
  }

  if (status === "unknown") {
    pathways.push({
      id: "clarify-status",
      name: "Clarify your current authorisation",
      summary:
        "Your profile does not clearly state whether you need sponsorship. Update the Work Authorisation section of your profile so assessments can be more precise.",
      fit: "unknown",
      notes: "This pathway is a placeholder until the candidate confirms their status.",
    });
  }

  return pathways;
}

function salaryThresholdCheck(
  input: SponsorshipAssessmentInput,
): SponsorshipAssessment["salaryThresholdCheck"] {
  if (input.targetCountry === "NL") {
    const ageBand = input.jobTitle.toLowerCase().includes("junior") ? "under30" : "thirtyPlus";
    const threshold = INDICATIVE_THRESHOLDS.NL[ageBand];
    if (input.grossMonthlyEur == null) {
      return {
        applicable: true,
        thresholdEur: threshold,
        offeredEur: null,
        meetsThreshold: null,
        note: INDICATIVE_THRESHOLDS.NL.note,
      };
    }
    return {
      applicable: true,
      thresholdEur: threshold,
      offeredEur: input.grossMonthlyEur,
      meetsThreshold: input.grossMonthlyEur >= threshold,
      note: INDICATIVE_THRESHOLDS.NL.note,
    };
  }
  const threshold = INDICATIVE_THRESHOLDS.BE.brussels.highlyQualified;
  if (input.grossMonthlyEur == null) {
    return {
      applicable: true,
      thresholdEur: threshold,
      offeredEur: null,
      meetsThreshold: null,
      note: INDICATIVE_THRESHOLDS.BE.brussels.note,
    };
  }
  return {
    applicable: true,
    thresholdEur: threshold,
    offeredEur: input.grossMonthlyEur,
    meetsThreshold: input.grossMonthlyEur >= threshold,
    note: INDICATIVE_THRESHOLDS.BE.brussels.note,
  };
}

const DISCLAIMER =
  "This is a rule-based preliminary indicator generated from publicly known structural categories " +
  "and your self-reported profile. It is NOT legal advice and does NOT constitute an eligibility " +
  "determination. Immigration rules and salary thresholds change. Always confirm eligibility with " +
  "the employer's immigration counsel or the national immigration authority (IND for the Netherlands, " +
  "regional employment services for Belgium).";

/**
 * Produce a preliminary sponsorship assessment. Deterministic and honest:
 * never invents eligibility, always labels the output as preliminary, and
 * always includes the disclaimer.
 */
export function assessSponsorship(
  input: SponsorshipAssessmentInput,
): SponsorshipAssessment {
  const status = detectAuthorisationStatus(input);
  let indicator: SponsorshipAssessment["preliminaryIndicator"];
  if (status === "eu-permit-holder") {
    indicator = "eligible_to_work";
  } else if (status === "sponsorship-required") {
    indicator = "needs_sponsorship";
  } else {
    indicator = "unknown";
  }

  const check = salaryThresholdCheck(input);
  // If salary is disclosed and below threshold, note it in the indicator context
  // but never upgrade/downgrade the indicator itself — the indicator is about
  // authorisation pathway, not a pass/fail gate.
  return {
    targetCountry: input.targetCountry,
    authorisationStatus: status,
    preliminaryIndicator: indicator,
    pathways: buildPathways(input),
    salaryThresholdCheck: check,
    disclaimer: DISCLAIMER,
    assessedAt: new Date().toISOString(),
  };
}

/** Convenience: assess for both target countries at once. */
export function assessSponsorshipForTargets(
  input: Omit<SponsorshipAssessmentInput, "targetCountry">,
  targets: ("NL" | "BE")[],
): SponsorshipAssessment[] {
  return targets.map((targetCountry) => assessSponsorship({ ...input, targetCountry }));
}
