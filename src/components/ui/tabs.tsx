"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Tabs({
  tabs,
  defaultValue,
  className,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  defaultValue?: string;
  className?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = React.useState(defaultValue ?? tabs[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string) {
    setActive(id);
    onChange?.(id);
  }

  function onKeyDown(event: React.KeyboardEvent, id: string) {
    const idx = tabs.findIndex((t) => t.id === id);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next =
        event.key === "ArrowRight"
          ? tabs[(idx + 1) % tabs.length]
          : tabs[(idx - 1 + tabs.length) % tabs.length];
      if (next) {
        select(next.id);
        refs.current[next.id]?.focus();
      }
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn(
        "inline-flex items-center gap-1 rounded-control border border-border bg-surface p-1",
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => select(tab.id)}
          onKeyDown={(e) => onKeyDown(e, tab.id)}
          className={cn(
            "rounded-[5px] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150",
            active === tab.id
              ? "bg-accent-subtle text-accent"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="data-font ml-1.5 text-[0.75rem] opacity-70">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  id,
  activeId,
  children,
  className,
}: {
  id: string;
  activeId: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (id !== activeId) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}
