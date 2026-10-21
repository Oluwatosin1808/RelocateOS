import type { CandidateProfile } from "../schemas/candidate-profile";
import type { Job } from "../schemas/job";

/**
 * Standard application answers — the copy-paste fields nearly every ATS asks
 * (name, email, work authorisation, notice period, salary…).
 *
 * HARD RULE: every value comes from a confirmed profile fact. When a fact is
 * missing the answer says so explicitly ("NOT ON PROFILE — …") rather than
 * guessing. Nothing here is ever invented, including "why this role" prose —
 * instead we surface real overlapping facts the user can weave in themselves.
 */

export type StandardAnswer = {
  key: string;
  label: string;
  value: string;
  /** Where the value comes from — profile field or explicit "missing" marker. */
  source: string;
};

const COUNTRY_NAMES: Record<string, string> = { NL: "the Netherlands", BE: "Belgium" };

function targetNames(profile: CandidateProfile): string {
  const targets = profile.relocationPreferences.targetCountries;
  if (targets.length === 0) return "my target countries";
  return targets.map((t) => COUNTRY_NAMES[t] ?? t).join(" or ");
}

export function buildStandardAnswers(
  profile: CandidateProfile,
  job: Pick<Job, "title" | "employerName" | "location" | "requiredSkills" | "preferredSkills">,
): StandardAnswer[] {
  const answers: StandardAnswer[] = [];
  const { contact, workAuthorisation, salaryPreferences, relocationPreferences } = profile;

  answers.push({
    key: "full_name",
    label: "Full name",
    value: contact.fullName || "NOT ON PROFILE — add your name in Profile → Contact",
    source: contact.fullName ? "contact.fullName" : "missing",
  });
  answers.push({
    key: "email",
    label: "Email",
    value: contact.email || "NOT ON PROFILE — add your email in Profile → Contact",
    source: contact.email ? "contact.email" : "missing",
  });
  answers.push({
    key: "phone",
    label: "Phone",
    value: contact.phone || "NOT ON PROFILE — add your phone in Profile → Contact",
    source: contact.phone ? "contact.phone" : "missing",
  });

  const location = [contact.currentCity, contact.currentCountry].filter(Boolean).join(", ");
  answers.push({
    key: "current_location",
    label: "Current location",
    value: location || "NOT ON PROFILE — add city/country in Profile → Contact",
    source: location ? "contact.currentCity/currentCountry" : "missing",
  });

  if (contact.nationality) {
    answers.push({
      key: "nationality",
      label: "Nationality",
      value: contact.nationality,
      source: "contact.nationality",
    });
  }

  // Work authorisation — the visa-critical answer. Stated plainly and
  // consistently; the immigration assessment module remains the authority on
  // eligibility, this only answers the form question truthfully.
  let workAuth: string;
  let workAuthSource: string;
  if (workAuthorisation.hasEuWorkPermit) {
    workAuth = workAuthorisation.euPermitDetails
      ? `Yes — ${workAuthorisation.euPermitDetails}`
      : "Yes — I hold an EU work permit (add details in Profile → Work authorisation).";
    workAuthSource = "workAuthorisation.hasEuWorkPermit";
  } else if (workAuthorisation.requiresEmployerSponsorship) {
    workAuth = `No — I require employer-sponsored work authorisation (${targetNames(profile)}: highly skilled migrant / single permit route). I am currently based in ${contact.currentCountry} and would need visa sponsorship as part of any offer.`;
    workAuthSource = "workAuthorisation.requiresEmployerSponsorship";
  } else {
    workAuth = "NOT ON PROFILE — set your sponsorship status in Profile → Work authorisation.";
    workAuthSource = "missing";
  }
  answers.push({
    key: "work_authorisation",
    label: "Work authorisation / sponsorship",
    value: workAuth,
    source: workAuthSource,
  });

  const notice = workAuthorisation.noticePeriodWeeks;
  answers.push({
    key: "notice_period",
    label: "Notice period",
    value:
      notice != null
        ? `${notice} week${notice === 1 ? "" : "s"}`
        : "NOT ON PROFILE — set your notice period in Profile → Work authorisation.",
    source: notice != null ? "workAuthorisation.noticePeriodWeeks" : "missing",
  });

  answers.push({
    key: "salary_expectation",
    label: "Salary expectation",
    value: `€${salaryPreferences.minGrossMonthlyEur.toLocaleString("en-GB")} gross per month minimum${salaryPreferences.notes ? ` (${salaryPreferences.notes})` : ""}`,
    source: "salaryPreferences.minGrossMonthlyEur",
  });

  const window = relocationPreferences.relocationWindowMonths;
  answers.push({
    key: "earliest_start",
    label: "Earliest start / relocation window",
    value: `Available to start after relocation, planned within ${window.min}–${window.max} months of an accepted offer.`,
    source: "relocationPreferences.relocationWindowMonths",
  });

  if (profile.languages.length > 0) {
    answers.push({
      key: "languages",
      label: "Languages",
      value: profile.languages.map((l) => `${l.language} (${l.proficiency})`).join(", "),
      source: "languages",
    });
  }

  if (contact.linkedinUrl) {
    answers.push({
      key: "linkedin",
      label: "LinkedIn",
      value: contact.linkedinUrl,
      source: "contact.linkedinUrl",
    });
  }

  // Real overlapping facts for "why this role / company" — bullets of truth,
  // NOT generated prose. The user writes the narrative; we never fabricate it.
  const jobSkills = new Set(
    [...job.requiredSkills, ...job.preferredSkills].map((s) => s.toLowerCase()),
  );
  const matched = profile.skills
    .filter((s) => jobSkills.has(s.name.toLowerCase()))
    .map((s) => s.name)
    .slice(0, 8);
  const facts: string[] = [];
  const latest = profile.workExperience[0];
  if (latest) {
    facts.push(`Current role: ${latest.jobTitle} at ${latest.employer}${latest.location ? ` (${latest.location})` : ""}.`);
  }
  if (matched.length > 0) {
    facts.push(`Skills on your profile that this job asks for: ${matched.join(", ")}.`);
  }
  if (profile.professionalSummary) {
    facts.push(`Your summary (edit to fit): ${profile.professionalSummary.slice(0, 220)}…`);
  }
  answers.push({
    key: "why_facts",
    label: `Facts for "why ${job.employerName}" (write in your own words)`,
    value: facts.length > 0 ? facts.join("\n• ") : "Complete your profile to generate real overlap facts.",
    source: "profile + job overlap",
  });

  return answers;
}

/** Render answers as a plain-text sheet for the packet / copy-paste use. */
export function renderAnswersSheet(
  answers: StandardAnswer[],
  job: Pick<Job, "title" | "employerName" | "location">,
): string {
  const lines = [
    `STANDARD ANSWERS — ${job.title} at ${job.employerName}`,
    job.location ? `Location: ${job.location}` : "",
    `Generated: ${new Date().toISOString()}`,
    "Every value comes from your confirmed profile. Fix anything marked NOT ON PROFILE",
    "in your Profile page, then re-download. Nothing here is invented.",
    "".padEnd(60, "="),
    "",
  ].filter(Boolean);
  for (const a of answers) {
    lines.push(`${a.label.toUpperCase()}  [${a.source}]`);
    lines.push(a.value.startsWith("•") || a.value.includes("\n") ? a.value : `  ${a.value}`);
    lines.push("");
  }
  return lines.join("\n");
}
