import { getSessionUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createLogger, newCorrelationId } from "@/lib/logging/logger";
import { loadCandidateProfile } from "@/lib/profile/dal";
import {
  assessSponsorshipForTargets,
  type SponsorshipAssessment,
} from "@domain/immigration/sponsorship";

/**
 * Preliminary sponsorship assessment for the candidate's target countries.
 * Rule-based, labelled preliminary, always includes the disclaimer.
 * NEVER a legal determination.
 */
export async function GET() {
  const correlationId = newCorrelationId();
  const log = createLogger({ module: "api.immigration.assessment", correlationId });
  const user = await getSessionUser();
  if (!user) {
    return jsonError(401, "unauthenticated", "Sign in to continue.", correlationId);
  }
  const profile = await loadCandidateProfile(user.uid);
  if (!profile) {
    return jsonError(409, "no_profile", "Complete onboarding first.", correlationId);
  }
  const assessments: SponsorshipAssessment[] = assessSponsorshipForTargets(
    {
      nationality: profile.contact.nationality,
      hasEuWorkPermit: profile.workAuthorisation.hasEuWorkPermit,
      freeTextPermitDetails: profile.workAuthorisation.euPermitDetails,
      requiresEmployerSponsorship: profile.workAuthorisation.requiresEmployerSponsorship,
      grossMonthlyEur: profile.salaryPreferences.minGrossMonthlyEur,
      jobTitle: profile.searchPreferences.roleFamilies[0]?.title ?? "",
    },
    profile.relocationPreferences.targetCountries,
  );
  log.info("sponsorship_assessed", {
    uid: user.uid,
    countries: assessments.map((a) => a.targetCountry),
  });
  return jsonOk({ assessments });
}
