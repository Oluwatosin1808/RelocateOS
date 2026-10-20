"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { WorkExperienceEditor, EducationEditor } from "@/components/profile/experience-editors";
import { ProjectsEditor, CertificationsEditor, LanguagesEditor } from "@/components/profile/skills-editors";
import type { CandidateProfile } from "@domain/schemas/candidate-profile";

export function ExperienceSections({ profile }: { profile: CandidateProfile }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  async function patchProfile(
    partial: Partial<CandidateProfile>,
    key: string,
  ): Promise<void> {
    setBusyKey(key);
    try {
      const next = { ...profile, ...partial };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? "Could not save.");
      }
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <WorkExperienceEditor
        profile={profile}
        saving={busyKey === "work"}
        onSave={(next) => patchProfile(next, "work")}
      />
      <EducationEditor
        profile={profile}
        saving={busyKey === "edu"}
        onSave={(next) => patchProfile(next, "edu")}
      />
      <ProjectsEditor
        profile={profile}
        saving={busyKey === "proj"}
        onSave={(next) => patchProfile(next, "proj")}
      />
      <CertificationsEditor
        profile={profile}
        saving={busyKey === "cert"}
        onSave={(next) => patchProfile(next, "cert")}
      />
      <LanguagesEditor
        profile={profile}
        saving={busyKey === "lang"}
        onSave={(next) => patchProfile(next, "lang")}
      />
    </>
  );
}
