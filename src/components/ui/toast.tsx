"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

type Toast = {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
};

type ToastContextValue = {
  push: (message: string, tone?: Toast["tone"]) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "pointer-events-auto rounded-card border bg-surface px-4 py-3 text-[0.8125rem] shadow-dialog",
                  t.tone === "success" && "border-success/30 text-success",
                  t.tone === "error" && "border-danger/30 text-danger",
                  t.tone === "info" && "border-border text-ink",
                )}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
