"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Accessible modal built on the native <dialog> element (focus trap + Esc for free).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const handleClose = () => onClose();
    el.addEventListener("cancel", handleCancel);
    el.addEventListener("close", handleClose);
    return () => {
      el.removeEventListener("cancel", handleCancel);
      el.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-desc" : undefined}
      className={cn(
        "m-auto w-full max-w-lg rounded-dialog border border-border bg-surface p-0 shadow-dialog backdrop:bg-ink/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <h2 id="dialog-title" className="text-[1rem] leading-6">
            {title}
          </h2>
          {description && (
            <p id="dialog-desc" className="text-[0.8125rem] text-ink-muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-control p-1 text-ink-subtle hover:bg-surface-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}
