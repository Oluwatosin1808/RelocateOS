"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/badge";
import type {
  Project,
  Certification,
  LanguageSkill,
  CandidateProfile,
} from "@domain/schemas/candidate-profile";

type DraftProject = Omit<Project, "provenance"> & { provenance?: Project["provenance"] };
type DraftCert = Omit<Certification, "provenance"> & { provenance?: Certification["provenance"] };
type DraftLang = Omit<LanguageSkill, "provenance"> & { provenance?: LanguageSkill["provenance"] };

function emptyProject(): DraftProject {
  return {
    id: `p_${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    url: "",
    description: "",
    technologies: [],
    role: "",
    startDate: "",
    endDate: "",
  };
}

function emptyCert(): DraftCert {
  return {
    id: `c_${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    issuer: "",
    issuedDate: "",
    expiresDate: "",
    credentialUrl: "",
  };
}

function emptyLang(): DraftLang {
  return {
    id: `l_${crypto.randomUUID().slice(0, 8)}`,
    language: "",
    proficiency: "conversational",
  };
}

function validateYearMonth(value: string): boolean {
  return value === "" || /^\d{4}(-\d{2})?$/.test(value);
}

export function ProjectsEditor({
  profile,
  onSave,
  saving,
}: {
  profile: CandidateProfile;
  onSave: (next: Pick<CandidateProfile, "projects">) => Promise<void>;
  saving: boolean;
}) {
  const [items, setItems] = React.useState<DraftProject[]>(() => profile.projects.map((p) => ({ ...p })));
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  function update(id: string, patch: Partial<DraftProject>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setDirty(true);
    setError(null);
  }

  async function save() {
    for (const p of items) {
      if (!p.name.trim()) {
        setError("Every project needs a name.");
        return;
      }
      if (!validateYearMonth(p.startDate) || !validateYearMonth(p.endDate)) {
        setError("Dates must be YYYY, YYYY-MM, or empty.");
        return;
      }
    }
    try {
      await onSave({
        projects: items.map((p) => ({ ...p, provenance: p.provenance ?? ("user-asserted" as const) })),
      });
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save projects.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Projects</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Portfolio pieces and side projects that support your application.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setItems((prev) => [...prev, emptyProject()]);
              setDirty(true);
            }}
          >
            Add project
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
        {items.length === 0 && <p className="text-[0.875rem] text-ink-muted">No projects yet.</p>}
        {items.map((item) => {
          return (
            <div key={item.id} className="space-y-4 rounded-control border border-border p-4">
              <div className="flex items-center justify-between">
                <Badge tone="info">User-asserted</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setItems((prev) => prev.filter((p) => p.id !== item.id));
                    setDirty(true);
                  }}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Project name" htmlFor={`${item.id}-name`} required>
                  <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} />
                </FormField>
                <FormField label="URL" htmlFor={`${item.id}-url`} error={item.url && !/^https?:\/\//.test(item.url) ? "Must start with http(s)://" : undefined}>
                  <Input id={`${item.id}-url`} placeholder="https://…" value={item.url} onChange={(e) => update(item.id, { url: e.target.value })} />
                </FormField>
                <FormField label="Role" htmlFor={`${item.id}-role`}>
                  <Input id={`${item.id}-role`} value={item.role} onChange={(e) => update(item.id, { role: e.target.value })} />
                </FormField>
                <FormField label="Technologies (comma-separated)" htmlFor={`${item.id}-tech`}>
                  <Input
                    id={`${item.id}-tech`}
                    value={item.technologies.join(", ")}
                    onChange={(e) =>
                      update(item.id, {
                        technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                      })
                    }
                  />
                </FormField>
                <FormField label="Start (YYYY or YYYY-MM)" htmlFor={`${item.id}-start`}>
                  <Input id={`${item.id}-start`} placeholder="2023-01" value={item.startDate} onChange={(e) => update(item.id, { startDate: e.target.value })} />
                </FormField>
                <FormField label="End (YYYY or YYYY-MM)" htmlFor={`${item.id}-end`}>
                  <Input id={`${item.id}-end`} placeholder="2024-06" value={item.endDate} onChange={(e) => update(item.id, { endDate: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Description" htmlFor={`${item.id}-desc`}>
                <Textarea id={`${item.id}-desc`} rows={2} value={item.description} onChange={(e) => update(item.id, { description: e.target.value })} />
              </FormField>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

export function CertificationsEditor({
  profile,
  onSave,
  saving,
}: {
  profile: CandidateProfile;
  onSave: (next: Pick<CandidateProfile, "certifications">) => Promise<void>;
  saving: boolean;
}) {
  const [items, setItems] = React.useState<DraftCert[]>(() => profile.certifications.map((c) => ({ ...c })));
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  function update(id: string, patch: Partial<DraftCert>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirty(true);
    setError(null);
  }

  async function save() {
    for (const c of items) {
      if (!c.name.trim()) {
        setError("Every certification needs a name.");
        return;
      }
      if (c.credentialUrl && !/^https?:\/\//.test(c.credentialUrl)) {
        setError("Credential URLs must start with http(s)://.");
        return;
      }
    }
    try {
      await onSave({
        certifications: items.map((c) => ({ ...c, provenance: c.provenance ?? ("user-asserted" as const) })),
      });
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save certifications.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Certifications</h3>
          <p className="text-[0.8125rem] text-ink-muted">Professional certificates and credentials.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setItems((prev) => [...prev, emptyCert()]);
              setDirty(true);
            }}
          >
            Add certification
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
        {items.length === 0 && <p className="text-[0.875rem] text-ink-muted">No certifications yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="grid gap-4 rounded-control border border-border p-4 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2">
              <Badge tone="info">User-asserted</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems((prev) => prev.filter((c) => c.id !== item.id));
                  setDirty(true);
                }}
              >
                Remove
              </Button>
            </div>
            <FormField label="Name" htmlFor={`${item.id}-name`} required>
              <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} />
            </FormField>
            <FormField label="Issuer" htmlFor={`${item.id}-issuer`}>
              <Input id={`${item.id}-issuer`} value={item.issuer} onChange={(e) => update(item.id, { issuer: e.target.value })} />
            </FormField>
            <FormField label="Issued (YYYY or YYYY-MM)" htmlFor={`${item.id}-issued`}>
              <Input id={`${item.id}-issued`} placeholder="2024-05" value={item.issuedDate} onChange={(e) => update(item.id, { issuedDate: e.target.value })} />
            </FormField>
            <FormField label="Expires (YYYY or YYYY-MM)" htmlFor={`${item.id}-expires`}>
              <Input id={`${item.id}-expires`} placeholder="2027-05" value={item.expiresDate} onChange={(e) => update(item.id, { expiresDate: e.target.value })} />
            </FormField>
            <FormField label="Credential URL" htmlFor={`${item.id}-url`} className="sm:col-span-2">
              <Input id={`${item.id}-url`} placeholder="https://…" value={item.credentialUrl} onChange={(e) => update(item.id, { credentialUrl: e.target.value })} />
            </FormField>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

const PROFICIENCIES = ["basic", "conversational", "professional", "fluent", "native"] as const;

export function LanguagesEditor({
  profile,
  onSave,
  saving,
}: {
  profile: CandidateProfile;
  onSave: (next: Pick<CandidateProfile, "languages">) => Promise<void>;
  saving: boolean;
}) {
  const [items, setItems] = React.useState<DraftLang[]>(() => profile.languages.map((l) => ({ ...l })));
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  function update(id: string, patch: Partial<DraftLang>) {
    setItems((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setDirty(true);
    setError(null);
  }

  async function save() {
    for (const l of items) {
      if (!l.language.trim()) {
        setError("Every language entry needs a language name.");
        return;
      }
    }
    try {
      await onSave({
        languages: items.map((l) => ({ ...l, provenance: l.provenance ?? ("user-asserted" as const) })),
      });
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save languages.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Languages</h3>
          <p className="text-[0.8125rem] text-ink-muted">
            Language proficiency is a user-asserted fact — never inferred from nationality.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setItems((prev) => [...prev, emptyLang()]);
              setDirty(true);
            }}
          >
            Add language
          </Button>
          <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        {items.length === 0 && <p className="text-[0.875rem] text-ink-muted">No languages yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-end gap-3 rounded-control border border-border p-3">
            <FormField label="Language" htmlFor={`${item.id}-lang`} className="min-w-40 flex-1">
              <Input id={`${item.id}-lang`} value={item.language} onChange={(e) => update(item.id, { language: e.target.value })} />
            </FormField>
            <FormField label="Proficiency" htmlFor={`${item.id}-prof`} className="w-44">
              <Select id={`${item.id}-prof`} value={item.proficiency} onChange={(e) => update(item.id, { proficiency: e.target.value as DraftLang["proficiency"] })}>
                {PROFICIENCIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setItems((prev) => prev.filter((l) => l.id !== item.id));
                setDirty(true);
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
