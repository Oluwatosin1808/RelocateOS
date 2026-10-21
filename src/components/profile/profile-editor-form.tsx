"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, FormField, Input, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@/lib/forms/zod-rhf";
import {
  COUNTRY_OPTIONS,
  DEFAULT_ROLE_FAMILIES,
  DEFAULT_SKILL_POOL,
  WORKPLACE_OPTIONS,
} from "@/lib/preferences/defaults";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";

const profileEditorSchema = z.object({
  fullName: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  phone: z.string().max(50).default(""),
  currentCity: z.string().max(120).default(""),
  nationality: z.string().max(120).default(""),
  linkedinUrl: z.string().url().or(z.literal("")).default(""),
  githubUrl: z.string().url().or(z.literal("")).default(""),
  professionalSummary: z.string().max(2000).default(""),
  requiresEmployerSponsorship: z.boolean().default(true),
  hasEuWorkPermit: z.boolean().default(false),
  noticePeriodWeeks: z.number().int().min(0).max(104).nullable().default(null),
  minGrossMonthlyEur: z.number().int().min(0).max(50000),
  targetCountries: z.array(z.enum(["NL", "BE"])).min(1),
  workplaceTypes: z.array(z.enum(["remote", "hybrid", "onsite"])).min(1),
  cityPreferencesText: z.string().default(""),
  roleFamilyIds: z.array(z.string()).min(1),
  skillsKeywordPool: z.array(z.string()).default([]),
});

type ProfileEditorValues = z.infer<typeof profileEditorSchema>;

export function ProfileEditorForm({ profile }: { profile: CandidateProfile }) {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  const form = useForm<ProfileEditorValues>({
    resolver: zodResolver(profileEditorSchema),
    defaultValues: {
      fullName: profile.contact.fullName,
      email: profile.contact.email,
      phone: profile.contact.phone,
      currentCity: profile.contact.currentCity,
      nationality: profile.contact.nationality,
      linkedinUrl: profile.contact.linkedinUrl,
      githubUrl: profile.contact.githubUrl,
      professionalSummary: profile.professionalSummary,
      requiresEmployerSponsorship: profile.workAuthorisation.requiresEmployerSponsorship,
      hasEuWorkPermit: profile.workAuthorisation.hasEuWorkPermit,
      noticePeriodWeeks: profile.workAuthorisation.noticePeriodWeeks,
      minGrossMonthlyEur: profile.salaryPreferences.minGrossMonthlyEur,
      targetCountries: profile.relocationPreferences.targetCountries,
      workplaceTypes: profile.relocationPreferences.workplaceTypes,
      cityPreferencesText: profile.relocationPreferences.cityPreferences.join(", "),
      roleFamilyIds: profile.searchPreferences.roleFamilies
        .filter((f) => f.enabled)
        .map((f) => f.id),
      skillsKeywordPool: profile.searchPreferences.skillsKeywordPool,
    },
    mode: "onTouched",
  });

  const { register, handleSubmit, watch, setValue, getValues, formState } = form;
  const errors = formState.errors;

  async function onSubmit(values: ProfileEditorValues) {
    setSaving(true);
    try {
      const cityPreferences = values.cityPreferencesText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const roleFamilies = values.roleFamilyIds.map((id) => {
        const existing = profile.searchPreferences.roleFamilies.find((f) => f.id === id);
        const def = DEFAULT_ROLE_FAMILIES.find((f) => f.id === id);
        return {
          id,
          title: existing?.title ?? def?.title ?? id,
          enabled: true,
          synonyms: existing?.synonyms ?? (def ? [...def.synonyms] : []),
          excludedTitles: existing?.excludedTitles ?? [],
          seniorityPreferences:
            existing?.seniorityPreferences ?? (["mid", "senior", "any"] as const),
          technologies: existing?.technologies ?? (def ? [...def.technologies] : []),
          industries: existing?.industries ?? [],
          minMatchScore: existing?.minMatchScore ?? 70,
          locations: existing?.locations ?? [],
        };
      });

      // Preserve disabled families so re-enabling later is not a data loss.
      for (const family of profile.searchPreferences.roleFamilies) {
        if (!values.roleFamilyIds.includes(family.id)) {
          roleFamilies.push({ ...family, enabled: false });
        }
      }

      const nextProfile = {
        ...profile,
        contact: {
          ...profile.contact,
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          currentCity: values.currentCity,
          nationality: values.nationality,
          linkedinUrl: values.linkedinUrl,
          githubUrl: values.githubUrl,
        },
        professionalSummary: values.professionalSummary,
        workAuthorisation: {
          ...profile.workAuthorisation,
          requiresEmployerSponsorship: values.requiresEmployerSponsorship,
          hasEuWorkPermit: values.hasEuWorkPermit,
          noticePeriodWeeks: values.noticePeriodWeeks,
        },
        salaryPreferences: {
          ...profile.salaryPreferences,
          minGrossMonthlyEur: values.minGrossMonthlyEur,
        },
        relocationPreferences: {
          ...profile.relocationPreferences,
          targetCountries: values.targetCountries,
          workplaceTypes: values.workplaceTypes,
          cityPreferences,
        },
        searchPreferences: {
          ...profile.searchPreferences,
          roleFamilies: roleFamilies.map((f) => ({
            ...f,
            seniorityPreferences: [...f.seniorityPreferences],
          })),
          skillsKeywordPool: values.skillsKeywordPool,
        },
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: nextProfile }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? "Could not save profile.");
      }
      toast.push("Profile saved.", "success");
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <h3>Contact</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Used on generated CVs and cover letters. Only user-asserted values — nothing is
            invented.
          </p>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
            <Input id="fullName" {...register("fullName")} />
          </FormField>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" {...register("email")} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register("phone")} />
          </FormField>
          <FormField label="Current city" htmlFor="currentCity" error={errors.currentCity?.message}>
            <Input id="currentCity" {...register("currentCity")} />
          </FormField>
          <FormField label="Nationality" htmlFor="nationality" error={errors.nationality?.message}>
            <Input id="nationality" {...register("nationality")} />
          </FormField>
          <FormField label="LinkedIn" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message}>
            <Input id="linkedinUrl" {...register("linkedinUrl")} />
          </FormField>
          <FormField label="GitHub" htmlFor="githubUrl" error={errors.githubUrl?.message}>
            <Input id="githubUrl" {...register("githubUrl")} />
          </FormField>
          <FormField
            label="Professional summary"
            htmlFor="professionalSummary"
            error={errors.professionalSummary?.message}
            className="sm:col-span-2"
          >
            <Textarea id="professionalSummary" rows={4} {...register("professionalSummary")} />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3>Relocation &amp; salary</h3>
        </CardHeader>
        <CardBody className="space-y-5">
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
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <FormField
              label="Preferred cities (comma-separated)"
              htmlFor="cityPreferencesText"
              error={errors.cityPreferencesText?.message}
            >
              <Input id="cityPreferencesText" {...register("cityPreferencesText")} />
            </FormField>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[0.875rem]">
              <Checkbox {...register("requiresEmployerSponsorship")} />
              Requires employer sponsorship
            </label>
            <label className="flex items-center gap-2 text-[0.875rem]">
              <Checkbox {...register("hasEuWorkPermit")} />
              Holds an EU work permit
            </label>
            <FormField
              label="Notice period (weeks)"
              htmlFor="noticePeriodWeeks"
              hint="Used in every application's standard answers. Leave empty if not applicable."
              error={errors.noticePeriodWeeks?.message}
            >
              <Input
                id="noticePeriodWeeks"
                type="number"
                placeholder="e.g. 4"
                {...register("noticePeriodWeeks", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
            </FormField>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3>Search preferences</h3>
        </CardHeader>
        <CardBody className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[0.8125rem] font-medium">Role families</legend>
            <div className="space-y-2">
              {DEFAULT_ROLE_FAMILIES.map((family) => {
                const known = profile.searchPreferences.roleFamilies.find(
                  (f) => f.id === family.id,
                );
                return (
                  <label
                    key={family.id}
                    className="flex items-start gap-2 rounded-control border border-border p-3 text-[0.875rem]"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={
                        known
                          ? watch("roleFamilyIds").includes(family.id)
                          : watch("roleFamilyIds").includes(family.id)
                      }
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
                );
              })}
            </div>
            {errors.roleFamilyIds && (
              <p role="alert" className="mt-1 text-[0.8125rem] text-danger">
                {errors.roleFamilyIds.message}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[0.8125rem] font-medium">Skill keywords</legend>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SKILL_POOL.map((skill) => {
                const active = watch("skillsKeywordPool").includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const cur = getValues("skillsKeywordPool");
                      const next = active ? cur.filter((s) => s !== skill) : [...cur, skill];
                      setValue("skillsKeywordPool", next, { shouldDirty: true });
                    }}
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
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
        <Badge tone="info">Every field is user-asserted</Badge>
      </div>
    </form>
  );
}
