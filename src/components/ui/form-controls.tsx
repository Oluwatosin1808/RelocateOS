import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-control border border-border-strong bg-surface px-3 text-[0.875rem] text-ink",
        "placeholder:text-ink-subtle disabled:bg-surface-muted disabled:text-ink-subtle",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-[0.875rem] text-ink",
      "placeholder:text-ink-subtle disabled:bg-surface-muted",
      "aria-[invalid=true]:border-danger min-h-24",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[0.875rem] text-ink",
      "disabled:bg-surface-muted disabled:text-ink-subtle aria-[invalid=true]:border-danger",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 rounded-[3px] border border-border-strong accent-accent",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        "h-5 w-9 shrink-0 appearance-none rounded-full bg-border-strong transition-colors duration-150",
        "checked:bg-accent relative cursor-pointer",
        "before:absolute before:left-0.5 before:top-0.5 before:size-4 before:rounded-full before:bg-white before:transition-transform before:content-['']",
        "checked:before:translate-x-4",
        className,
      )}
      {...props}
    />
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[0.8125rem] font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-[0.8125rem] text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
