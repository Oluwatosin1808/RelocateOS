"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/** Triggers a DOCX download from an API route. */
export function DownloadDocButton({
  href,
  label,
  variant = "secondary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [busy, setBusy] = React.useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Download failed (${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      a.download = match?.[1] ?? "document.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size="sm" loading={busy} onClick={() => void download()}>
      {label}
    </Button>
  );
}
