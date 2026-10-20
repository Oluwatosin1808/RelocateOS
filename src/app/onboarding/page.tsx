"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, FormField, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@/lib/forms/zod-rhf";
import {
  COUNTRY_OPTIONS,
  DEFAULT_ROLE_FAMILIES,
  DEFAULT_SKILL_POOL,
  SUGGESTED_GREENHOUSE_BOARDS,
  WORKPLACE_OPTIONS,
} from "@/lib/preferences/defaults";

const onboardingSchema = z.object({
  fullName: z.string().min(1, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().max(50).default(""),
  currentCity: z.string().max(120).default(""),
  nationality: z.string().max(120).default(""),
  linkedinUrl: z.string().url("Must be a valid URL").or(z.literal("")).default(""),
  githubUrl: z.string().url("Must be a valid URL").or(z.literal("")).default(""),
  professionalSummary: z.string().max(2000).default(""),
  requiresEmployerSponsorship: z.boolean().default(true),
  hasEuWorkPermit: z.boolean().default(false),
  euPermitDetails: z.string().max(1000).default(""),
  targetCountries: z.array(z.enum(["NL", "BE"])).min(1, "Pick at least one country"),
  cityPreferences: z.array(z.string()).default([]),
  workplaceTypes: z
    .array(z.enum(["remote", "hybrid", "onsite"]))
    .min(1, "Pick at least one workplace type"),
  relocationWindowMin: z.number().int().min(0).max(60),
  relocationWindowMax: z.number().int().min(1).max(60),
  minGrossMonthlyEur: z.number().int().min(0).max(50000),
  roleFamilyIds: z.array(z.string()).min(1, "Pick at least one role family"),
  skillsKeywordPool: z.array(z.string()).default([]),
  sourceBoardTokens: z.array(z.string()).default([]),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const STEPS = ["About you", "Relocation", "Roles & skills", "Job sources", "Review"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [citiesText, setCitiesText] = React.useState("");

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      currentCity: "",
      nationality: "Nigerian",
      linkedinUrl: "",
      githubUrl: "",
      professionalSummary: "",
      requiresEmployerSponsorship: true,
      hasEuWorkPermit: false,
      euPermitDetails: "",
      targetCountries: ["NL", "BE"],
      cityPreferences: [],
      workplaceTypes: ["remote", "hybrid"],
      relocationWindowMin: 6,
      relocationWindowMax: 12,
      minGrossMonthlyEur: 3000,
      roleFamilyIds: ["frontend-developer"],
      skillsKeywordPool: [...DEFAULT_SKILL_POOL.slice(0, 12)],
      sourceBoardTokens: ["adyen", "elastic"],
    },
    mode: "onTouched",
  });

  const { register, handleSubmit, watch, setValue, formState, getValues } = form;
  const errors = formState.errors;
  const isSubmitting = formState.isSubmitting;

  async function onNext() {
    const fieldsByStep: (keyof OnboardingValues)[][] = [
      ["fullName", "email", "phone", "currentCity", "nationality", "linkedinUrl", "githubUrl"],
      [
        "targetCountries",
        "workplaceTypes",
        "relocationWindowMin",
        "relocationWindowMax",
        "minGrossMonthlyEur",
        "requiresEmployerSponsorship",
        "hasEuWorkPermit",
      ],
      ["roleFamilyIds", "skillsKeywordPool"],
      ["sourceBoardTokens"],
      [],
    ];
    const ok = await form.trigger(fieldsByStep[step] as never[], { shouldFocus: true });
    if (!ok) {
      toast.push("Fix the highlighted fields to continue.", "error");
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  async function onSubmit(values: OnboardingValues) {
    setSaving(true);
    try {
      const cityPreferences = citiesText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const roleFamilies = values.roleFamilyIds.map((id) => {
        const def = DEFAULT_ROLE_FAMILIES.find((f) => f.id === id);
        return {
          id,
          title: def?.title ?? id,
          enabled: true,
          synonyms: def ? [...def.synonyms] : [],
          excludedTitles: [],
          seniorityPreferences: ["mid", "senior", "any"] as const,
          technologies: def ? [...def.technologies] : [],
          industries: [],
          minMatchScore: 70,
          locations: [],
        };
      });

      const profile = {
        contact: {
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          currentCity: values.currentCity,
          currentCountry: "Nigeria",
          nationality: values.nationality,
          linkedinUrl: values.linkedinUrl,
          githubUrl: values.githubUrl,
          portfolioUrls: [],
        },
        professionalSummary: values.professionalSummary,
        workAuthorisation: {
          hasEuWorkPermit: values.hasEuWorkPermit,
          euPermitDetails: values.euPermitDetails,
          requiresEmployerSponsorship: values.requiresEmployerSponsorship,
          immigrationHistory: "",
          notes: "",
        },
        relocationPreferences: {
          currentCountry: "Nigeria",
          targetCountries: values.targetCountries,
          relocationWindowMonths: {
            min: values.relocationWindowMin,
            max: values.relocationWindowMax,
          },
          preferredWorkingLanguage: "English",
          preferredAccommodation: "flexible",
          employmentObjective:
            "Obtain a legitimate job offer and the appropriate authorisation to live and work in the destination country.",
          cityPreferences,
          workplaceTypes: values.workplaceTypes,
        },
        salaryPreferences: {
          minGrossMonthlyEur: values.minGrossMonthlyEur,
          currency: "EUR" as const,
          notes: "",
        },
        searchPreferences: {
          roleFamilies: roleFamilies.map((f) => ({
            ...f,
            seniorityPreferences: [...f.seniorityPreferences],
          })),
          skillsKeywordPool: values.skillsKeywordPool,
        },
      };

      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!profileRes.ok) {
        const body = (await profileRes.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? "Could not save your profile.");
      }

      for (const boardToken of values.sourceBoardTokens) {
        const board = SUGGESTED_GREENHOUSE_BOARDS.find((b) => b.boardToken === boardToken);
        const res = await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "greenhouse",
            displayName: board?.displayName ?? boardToken,
            configuration: { boardToken },
            enabled: true,
          }),
        });
        if (!res.ok && res.status !== 409) {
          const body = (await res.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(body?.error?.message ?? `Could not add source ${boardToken}.`);
        }
      }

      const completeRes = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!completeRes.ok) throw new Error("Could not finish setup.");

      toast.push("Setup saved. Run your first job scan from Scout.", "success");
      router.replace("/scout");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardBody className="space-y-6">
          <div className="space-y-1">
            <p className="eyebrow">Onboarding · step {step + 1} of {STEPS.length}</p>
            <h1>{STEPS[step]}</h1>
            <p className="text-[0.875rem] text-ink-muted">
              Every field you fill is stored as a user-asserted fact. Nothing is guessed.
            </p>
          </div>

          <ol className="flex flex-wrap gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label}>
                <Badge tone={i === step ? "accent" : i < step ? "success" : "neutral"}>
                  {i < step ? "✓ " : ""}
                  {label}
                </Badge>
              </li>
            ))}
          </ol>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
                  <Input id="fullName" autoComplete="name" {...register("fullName")} />
                </FormField>
                <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
                  <Input id="email" type="email" autoComplete="email" {...register("email")} />
                </FormField>
                <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
                  <Input id="phone" autoComplete="tel" {...register("phone")} />
                </FormField>
                <FormField label="Current city" htmlFor="currentCity" error={errors.currentCity?.message}>
                  <Input id="currentCity" autoComplete="address-level2" {...register("currentCity")} />
                </FormField>
                <FormField label="Nationality" htmlFor="nationality" error={errors.nationality?.message}>
                  <Input id="nationality" {...register("nationality")} />
                </FormField>
                <FormField label="LinkedIn URL" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message}>
                  <Input id="linkedinUrl" placeholder="https://linkedin.com/in/…" {...register("linkedinUrl")} />
                </FormField>
                <FormField label="GitHub URL" htmlFor="githubUrl" error={errors.githubUrl?.message}>
                  <Input id="githubUrl" placeholder="https://github.com/…" {...register("githubUrl")} />
                </FormField>
                <FormField
                  label="Professional summary"
                  htmlFor="professionalSummary"
                  hint="Optional now — you can complete this later on the Profile page."
                  error={errors.professionalSummary?.message}
                  className="sm:col-span-2"
                >
                  <textarea
                    id="professionalSummary"
                    className="min-h-24 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-[0.875rem]"
                    {...register("professionalSummary")}
                  />
                </FormField>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-[0.8125rem] font-medium">Target countries</legend>
                  <div className="flex flex-wrap gap-4">
                    {COUNTRY_OPTIONS.map((c) => (
                      <label key={c.code} className="flex items-center gap-2 text-[0.875rem]">
                        <Checkbox
                          checked={watch("targetCountries").includes(c.code)}
                          onChange={(e) => {
                            const cur = getValues("targetCountries");
                            const next = e.target.checked
                              ? ([...cur, c.code] as ("NL" | "BE")[])
                              : cur.filter((x) => x !== c.code);
                            setValue("targetCountries", next, { shouldDirty: true });
                          }}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  {errors.targetCountries && (
                    <p role="alert" className="mt-1 text-[0.8125rem] text-danger">
                      {errors.targetCountries.message}
                    </p>
                  )}
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-[0.8125rem] font-medium">Workplace types</legend>
                  <div className="flex flex-wrap gap-4">
                    {WORKPLACE_OPTIONS.map((w) => (
                      <label key={w.code} className="flex items-center gap-2 text-[0.875rem]">
                        <Checkbox
                          checked={watch("workplaceTypes").includes(w.code)}
                          onChange={(e) => {
                            const cur = getValues("workplaceTypes");
                            const next = e.target.checked
                              ? ([...cur, w.code] as typeof cur)
                              : cur.filter((x) => x !== w.code);
                            setValue("workplaceTypes", next, { shouldDirty: true });
                          }}
                        />
                        {w.label}
                      </label>
                    ))}
                  </div>
                  {errors.workplaceTypes && (
                    <p role="alert" className="mt-1 text-[0.8125rem] text-danger">
                      {errors.workplaceTypes.message}
                    </p>
                  )}
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    label="Relocation window (months, min)"
                    htmlFor="relocationWindowMin"
                    error={errors.relocationWindowMin?.message}
                  >
                    <Input
                      id="relocationWindowMin"
                      type="number"
                      {...register("relocationWindowMin", { valueAsNumber: true })}
                    />
                  </FormField>
                  <FormField
                    label="Relocation window (months, max)"
                    htmlFor="relocationWindowMax"
                    error={errors.relocationWindowMax?.message}
                  >
                    <Input
                      id="relocationWindowMax"
                      type="number"
                      {...register("relocationWindowMax", { valueAsNumber: true })}
                    />
                  </FormField>
                  <FormField
                    label="Minimum gross monthly (EUR)"
                    htmlFor="minGrossMonthlyEur"
                    error={errors.minGrossMonthlyEur?.message}
                  >
                    <Input
                      id="minGrossMonthlyEur"
                      type="number"
                      {...register("minGrossMonthlyEur", { valueAsNumber: true })}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Preferred cities (comma-separated)"
                  htmlFor="cities"
                  hint="Leave blank to accept any city in the selected countries."
                >
                  <Input
                    id="cities"
                    value={citiesText}
                    onChange={(e) => setCitiesText(e.target.value)}
                    placeholder="Amsterdam, Rotterdam, Brussels"
                  />
                </FormField>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[0.875rem]">
                    <Checkbox {...register("requiresEmployerSponsorship")} />
                    I need employer sponsorship to work in the EU
                  </label>
                  <label className="flex items-center gap-2 text-[0.875rem]">
                    <Checkbox {...register("hasEuWorkPermit")} />
                    I already hold an EU work permit
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-[0.8125rem] font-medium">Role families</legend>
                  <div className="space-y-2">
                    {DEFAULT_ROLE_FAMILIES.map((family) => (
                      <label
                        key={family.id}
                        className="flex items-start gap-2 rounded-control border border-border p-3 text-[0.875rem]"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={watch("roleFamilyIds").includes(family.id)}
                          onChange={(e) => {
                            const cur = getValues("roleFamilyIds");
                            const next = e.target.checked
                              ? [...cur, family.id]
                              : cur.filter((x) => x !== family.id);
                            setValue("roleFamilyIds", next, { shouldDirty: true });
                          }}
                        />
                        <span>
                          <span className="font-medium">{family.title}</span>
                          <span className="block text-[0.8125rem] text-ink-muted">
                            {family.synonyms.join(" · ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.roleFamilyIds && (
                    <p role="alert" className="mt-1 text-[0.8125rem] text-danger">
                      {errors.roleFamilyIds.message}
                    </p>
                  )}
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-[0.8125rem] font-medium">
                    Skill keywords used for discovery
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_SKILL_POOL.map((skill) => {
                      const active = watch("skillsKeywordPool").includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            const cur = getValues("skillsKeywordPool");
                            const next = active
                              ? cur.filter((s) => s !== skill)
                              : [...cur, skill];
                            setValue("skillsKeywordPool", next, { shouldDirty: true });
                          }}
                          aria-pressed={active}
                          className={
                            active
                              ? "rounded-full border border-accent/30 bg-accent-subtle px-2.5 py-1 text-[0.75rem] font-medium text-accent"
                              : "rounded-full border border-border px-2.5 py-1 text-[0.75rem] text-ink-muted hover:bg-surface-muted"
                          }
                        >
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-[0.875rem] text-ink-muted">
                  These Greenhouse boards were verified live during setup. Health is re-checked
                  on every scan — a board that later 404s is reported as failing, never hidden.
                </p>
                {SUGGESTED_GREENHOUSE_BOARDS.map((board) => (
                  <label
                    key={board.boardToken}
                    className="flex items-start gap-2 rounded-control border border-border p-3 text-[0.875rem]"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={watch("sourceBoardTokens").includes(board.boardToken)}
                      onChange={(e) => {
                        const cur = getValues("sourceBoardTokens");
                        const next = e.target.checked
                          ? [...cur, board.boardToken]
                          : cur.filter((x) => x !== board.boardToken);
                        setValue("sourceBoardTokens", next, { shouldDirty: true });
                      }}
                    />
                    <span>
                      <span className="font-medium">{board.displayName}</span>
                      <span className="block text-[0.8125rem] text-ink-muted">
                        {board.note} · greenhouse/{board.boardToken}
                      </span>
                    </span>
                  </label>
                ))}
                {errors.sourceBoardTokens && (
                  <p role="alert" className="text-[0.8125rem] text-danger">
                    {errors.sourceBoardTokens.message}
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <ReviewSummary values={watch()} citiesText={citiesText} />
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={step === 0 || saving}
                onClick={() => setStep(Math.max(0, step - 1))}
              >
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={onNext}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={saving || isSubmitting}>
                  Save setup
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function ReviewSummary({
  values,
  citiesText,
}: {
  values: OnboardingValues;
  citiesText: string;
}) {
  const countries = values.targetCountries
    .map((c) => COUNTRY_OPTIONS.find((o) => o.code === c)?.label ?? c)
    .join(", ");
  const roles = values.roleFamilyIds
    .map((id) => DEFAULT_ROLE_FAMILIES.find((f) => f.id === id)?.title ?? id)
    .join(", ");
  const boards = values.sourceBoardTokens
    .map((t) => SUGGESTED_GREENHOUSE_BOARDS.find((b) => b.boardToken === t)?.displayName ?? t)
    .join(", ");
  return (
    <dl className="space-y-3 text-[0.875rem]">
      <div>
        <dt className="text-ink-muted">Name</dt>
        <dd>{values.fullName || "—"}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">Targets</dt>
        <dd>
          {countries}
          {citiesText ? ` · cities: ${citiesText}` : ""}
        </dd>
      </div>
      <div>
        <dt className="text-ink-muted">Workplace</dt>
        <dd>{values.workplaceTypes.join(", ")}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">Salary floor</dt>
        <dd>€{values.minGrossMonthlyEur.toLocaleString("en-GB")} / month gross</dd>
      </div>
      <div>
        <dt className="text-ink-muted">Roles</dt>
        <dd>{roles}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">Job sources</dt>
        <dd>{boards || "None selected — you can add sources later"}</dd>
      </div>
      <div>
        <dt className="text-ink-muted">Sponsorship</dt>
        <dd>
          {values.requiresEmployerSponsorship
            ? "Requires employer sponsorship"
            : "No sponsorship required"}
          {values.hasEuWorkPermit ? " · holds EU work permit" : ""}
        </dd>
      </div>
    </dl>
  );
}
