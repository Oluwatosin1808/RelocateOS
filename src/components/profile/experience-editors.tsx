"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/badge";
import type {
  WorkExperience,
  Education,
  CandidateProfile,
} from "@domain/schemas/candidate-profile";

type DraftWork = Omit<WorkExperience, "provenance"> & { provenance?: WorkExperience["provenance"] };
type DraftEducation = Omit<Education, "provenance"> & { provenance?: Education["provenance"] };

function emptyWork(): DraftWork {
  return {
    id: `w_${crypto.randomUUID().slice(0, 8)}`,
    jobTitle: "",
    employer: "",
    location: "",
    employmentType: "full-time",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
    technologies: [],
  };
}

function emptyEducation(): DraftEducation {
  return {
    id: `e_${crypto.randomUUID().slice(0, 8)}`,
    institution: "",
    qualification: "",
    fieldOfStudy: "",
    startDate: "",
    endDate: "",
    description: "",
  };
}

function toWorkDrafts(profile: CandidateProfile): DraftWork[] {
  return profile.workExperience.map((w) => ({ ...w }));
}

function toEducationDrafts(profile: CandidateProfile): DraftEducation[] {
  return profile.education.map((e) => ({ ...e }));
}

function validateWork(list: DraftWork[]): string | null {
  for (const w of list) {
    if (!w.jobTitle.trim()) return "Every work entry needs a job title.";
    if (!w.employer.trim()) return "Every work entry needs an employer.";
    if (!/^\d{4}(-\d{2})?$/.test(w.startDate)) {
      return "Start date must be YYYY or YYYY-MM.";
    }
    if (w.endDate && !/^\d{4}(-\d{2})?$/.test(w.endDate)) {
      return "End date must be YYYY, YYYY-MM, or empty.";
    }
    if (!w.isCurrent && !w.endDate) return "Set an end date or mark the role as current.";
  }
  return null;
}

function validateEducation(list: DraftEducation[]): string | null {
  for (const e of list) {
    if (!e.institution.trim()) return "Every education entry needs an institution.";
    if (!e.qualification.trim()) return "Every education entry needs a qualification.";
  }
  return null;
}

export function WorkExperienceEditor({
  profile,
  onSave,
  saving,
}: {
  profile: CandidateProfile;
  onSave: (next: Pick<CandidateProfile, "workExperience">) => Promise<void>;
  saving: boolean;
}) {
  const [items, setItems] = React.useState<DraftWork[]>(() => toWorkDrafts(profile));
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  function update(id: string, patch: Partial<DraftWork>) {
    setItems((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    setDirty(true);
    setError(null);
  }

  async function save() {
    const validationError = validateWork(items);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await onSave({
        workExperience: items.map((w) => ({
          ...w,
          provenance: w.provenance ?? ("user-asserted" as const),
        })),
      });
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save work experience.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Work experience</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Facts you confirm here are used verbatim on generated CVs. Dates use YYYY or YYYY-MM.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setItems((prev) => [...prev, emptyWork()]);
              setDirty(true);
            }}
          >
            Add role
          </Button>
          <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {error && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        {items.length === 0 && (
          <p className="text-[0.875rem] text-ink-muted">No work experience yet. Add your first role.</p>
        )}
        {items.map((item) => (
          <WorkCard
            key={item.id}
            item={item}
            onChange={(patch) => update(item.id, patch)}
            onRemove={() => {
              setItems((prev) => prev.filter((w) => w.id !== item.id));
              setDirty(true);
            }}
          />
        ))}
      </CardBody>
    </Card>
  );
}

function WorkCard({
  item,
  onChange,
  onRemove,
}: {
  item: DraftWork;
  onChange: (patch: Partial<DraftWork>) => void;
  onRemove: () => void;
}) {
  const [techText, setTechText] = React.useState(item.technologies.join(", "));
  return (
    <div className="space-y-4 rounded-control border border-border p-4">
      <div className="flex items-center justify-between">
        <Badge tone={item.provenance === "imported-pending-review" ? "warning" : "info"}>
          {item.provenance === "imported-pending-review" ? "Imported · pending review" : "User-asserted"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Job title" htmlFor={`${item.id}-title`} required>
          <Input
            id={`${item.id}-title`}
            value={item.jobTitle}
            onChange={(e) => onChange({ jobTitle: e.target.value })}
          />
        </FormField>
        <FormField label="Employer" htmlFor={`${item.id}-employer`} required>
          <Input
            id={`${item.id}-employer`}
            value={item.employer}
            onChange={(e) => onChange({ employer: e.target.value })}
          />
        </FormField>
        <FormField label="Location" htmlFor={`${item.id}-location`}>
          <Input
            id={`${item.id}-location`}
            value={item.location}
            onChange={(e) => onChange({ location: e.target.value })}
          />
        </FormField>
        <FormField label="Employment type" htmlFor={`${item.id}-type`}>
          <Select
            id={`${item.id}-type`}
            value={item.employmentType}
            onChange={(e) =>
              onChange({ employmentType: e.target.value as DraftWork["employmentType"] })
            }
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="freelance">Freelance</option>
            <option value="unknown">Unknown</option>
          </Select>
        </FormField>
        <FormField label="Start date (YYYY or YYYY-MM)" htmlFor={`${item.id}-start`} required>
          <Input
            id={`${item.id}-start`}
            placeholder="2022-03"
            value={item.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </FormField>
        <FormField
          label="End date (YYYY or YYYY-MM)"
          htmlFor={`${item.id}-end`}
          hint={item.isCurrent ? "Current role — end date ignored" : undefined}
        >
          <Input
            id={`${item.id}-end`}
            placeholder="2024-11"
            value={item.endDate}
            disabled={item.isCurrent}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-[0.875rem]">
        <input
          type="checkbox"
          className="size-4 rounded-[3px] border border-border-strong accent-accent"
          checked={item.isCurrent}
          onChange={(e) => onChange({ isCurrent: e.target.checked, endDate: e.target.checked ? "" : item.endDate })}
        />
        I currently work here
      </label>
      <FormField label="Technologies (comma-separated)" htmlFor={`${item.id}-tech`}>
        <Input
          id={`${item.id}-tech`}
          value={techText}
          onChange={(e) => {
            setTechText(e.target.value);
            onChange({
              technologies: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            });
          }}
        />
      </FormField>
      <FormField label="Description" htmlFor={`${item.id}-desc`}>
        <Textarea
          id={`${item.id}-desc`}
          rows={3}
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </FormField>
    </div>
  );
}

export function EducationEditor({
  profile,
  onSave,
  saving,
}: {
  profile: CandidateProfile;
  onSave: (next: Pick<CandidateProfile, "education">) => Promise<void>;
  saving: boolean;
}) {
  const [items, setItems] = React.useState<DraftEducation[]>(() => toEducationDrafts(profile));
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  function update(id: string, patch: Partial<DraftEducation>) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setDirty(true);
    setError(null);
  }

  async function save() {
    const validationError = validateEducation(items);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await onSave({
        education: items.map((e) => ({
          ...e,
          provenance: e.provenance ?? ("user-asserted" as const),
        })),
      });
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save education.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Education</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Degrees, bootcamps and certificates that support your application.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setItems((prev) => [...prev, emptyEducation()]);
              setDirty(true);
            }}
          >
            Add education
          </Button>
          <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {error && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        {items.length === 0 && (
          <p className="text-[0.875rem] text-ink-muted">No education entries yet.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="space-y-4 rounded-control border border-border p-4">
            <div className="flex items-center justify-between">
              <Badge tone="info">User-asserted</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems((prev) => prev.filter((e) => e.id !== item.id));
                  setDirty(true);
                }}
              >
                Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Institution" htmlFor={`${item.id}-inst`} required>
                <Input
                  id={`${item.id}-inst`}
                  value={item.institution}
                  onChange={(e) => update(item.id, { institution: e.target.value })}
                />
              </FormField>
              <FormField label="Qualification" htmlFor={`${item.id}-qual`} required>
                <Input
                  id={`${item.id}-qual`}
                  placeholder="B.Sc. / Bootcamp / Certificate"
                  value={item.qualification}
                  onChange={(e) => update(item.id, { qualification: e.target.value })}
                />
              </FormField>
              <FormField label="Field of study" htmlFor={`${item.id}-field`}>
                <Input
                  id={`${item.id}-field`}
                  value={item.fieldOfStudy}
                  onChange={(e) => update(item.id, { fieldOfStudy: e.target.value })}
                />
              </FormField>
              <FormField label="Grade (optional)" htmlFor={`${item.id}-grade`}>
                <Input
                  id={`${item.id}-grade`}
                  value={item.grade ?? ""}
                  onChange={(e) => update(item.id, { grade: e.target.value })}
                />
              </FormField>
              <FormField label="Start (YYYY or YYYY-MM)" htmlFor={`${item.id}-start`}>
                <Input
                  id={`${item.id}-start`}
                  placeholder="2018-09"
                  value={item.startDate}
                  onChange={(e) => update(item.id, { startDate: e.target.value })}
                />
              </FormField>
              <FormField label="End (YYYY or YYYY-MM)" htmlFor={`${item.id}-end`}>
                <Input
                  id={`${item.id}-end`}
                  placeholder="2022-06"
                  value={item.endDate}
                  onChange={(e) => update(item.id, { endDate: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Description" htmlFor={`${item.id}-desc`}>
              <Textarea
                id={`${item.id}-desc`}
                rows={2}
                value={item.description}
                onChange={(e) => update(item.id, { description: e.target.value })}
              />
            </FormField>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
