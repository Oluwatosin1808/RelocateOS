import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Hidden below this Tailwind breakpoint pixel width (approx). */
  hideBelow?: "sm" | "md" | "lg";
};

const hideClasses = {
  sm: "max-sm:hidden",
  md: "max-md:hidden",
  lg: "max-lg:hidden",
};

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  empty,
  className,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  className?: string;
  caption?: string;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }
  return (
    <div className={cn("overflow-x-auto rounded-card border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-left text-[0.8125rem]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  "eyebrow px-3 py-2.5 font-semibold whitespace-nowrap",
                  col.hideBelow && hideClasses[col.hideBelow],
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-border last:border-b-0 transition-colors duration-100",
                onRowClick && "cursor-pointer hover:bg-surface-muted",
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    "px-3 py-2.5 align-middle",
                    col.hideBelow && hideClasses[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
