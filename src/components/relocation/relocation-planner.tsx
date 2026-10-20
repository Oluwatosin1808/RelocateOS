"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { ChecklistItem } from "@domain/relocation/planner";

const CATEGORY_LABELS: Record<string, string> = {
  permit: "Permit & visa",
  documents: "Documents",
  housing: "Housing",
  finance: "Finance",
  healthcare: "Healthcare",
  arrival: "Arrival & registration",
};

export function RelocationPlanner({
  country,
  initialItems,
  budget,
}: {
  country: "NL" | "BE";
  initialItems: ChecklistItem[];
  budget: { label: string; lowEur: number; highEur: number; note: string; source: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = React.useState(initialItems);
  const [busy, setBusy] = React.useState<string | null>(null);

  const completed = items.filter((i) => i.completed).length;

  async function toggle(item: ChecklistItem) {
    const next = !item.completed;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: next, completedAt: next ? new Date().toISOString() : null } : i)),
    );
    setBusy(item.id);
    try {
      const res = await fetch("/api/relocation/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, itemId: item.id, completed: next }),
      });
      if (!res.ok) throw new Error("Update failed.");
      toast.push(next ? "Marked complete." : "Reopened.", "success");
      router.refresh();
    } catch (err) {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, completed: !next } : i)),
      );
      toast.push(err instanceof Error ? err.message : "Update failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  const byCategory = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <p className="text-[0.8125rem] text-ink-muted">Checklist progress</p>
            <p className="data-font text-[1.25rem] font-semibold">
              {completed}/{items.length}
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${items.length > 0 ? (completed / items.length) * 100 : 0}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {/* Checklist by category */}
      {Array.from(byCategory.entries()).map(([category, catItems]) => (
        <Card key={category}>
          <CardHeader>
            <h3>{CATEGORY_LABELS[category] ?? category}</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {catItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <Checkbox
                  checked={item.completed}
                  onChange={() => void toggle(item)}
                  disabled={busy === item.id}
                  aria-label={`Mark "${item.title}" as ${item.completed ? "incomplete" : "complete"}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[0.875rem] font-medium ${item.completed ? "text-ink-subtle line-through" : "text-ink"}`}>
                      {item.title}
                    </p>
                    <Badge tone={item.source === "official" ? "success" : "neutral"}>
                      {item.source === "official" ? "Official" : "Guidance"}
                    </Badge>
                  </div>
                  <p className="text-[0.8125rem] text-ink-muted">{item.detail}</p>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-[0.8125rem] font-medium text-accent hover:underline"
                    >
                      Official source ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}

      {/* Budget estimates */}
      <Card>
        <CardHeader>
          <h3>Budget estimates</h3>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-[0.8125rem] text-ink-muted">
            These are rough estimates for planning purposes only — not official fee schedules.
            Confirm current amounts with the relevant authority before committing.
          </p>
          <ul className="space-y-3">
            {budget.map((b) => (
              <li key={b.label} className="flex flex-wrap items-baseline justify-between gap-2 rounded-control border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-medium text-ink">{b.label}</p>
                  <p className="text-[0.8125rem] text-ink-muted">{b.note}</p>
                </div>
                <p className="data-font shrink-0 text-[0.9375rem] font-semibold">
                  €{b.lowEur.toLocaleString()} – €{b.highEur.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
