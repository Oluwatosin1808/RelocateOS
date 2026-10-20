"use client";

import * as React from "react";
import { BulkActionsBar } from "@/components/jobs/scout-controls";
import { JobRow } from "@/components/jobs/job-row";
import type { Job } from "@domain/schemas/job";

/**
 * Client wrapper for the Scout job list: checkbox selection + bulk
 * shortlist/archive actions. Selection state is local to this list.
 */
export function ScoutJobList({
  jobs,
  minSalary,
  scores,
}: {
  jobs: Job[];
  minSalary?: number | null;
  scores?: Record<string, number | null> | null;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  function toggle(id: string, isSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="space-y-3">
      <BulkActionsBar selectedIds={selectedIds} onClear={() => setSelected(new Set())} />
      <ul className="space-y-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobRow
              job={job}
              minSalary={minSalary}
              score={scores?.[job.id] ?? null}
              selected={selected.has(job.id)}
              onToggle={toggle}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
