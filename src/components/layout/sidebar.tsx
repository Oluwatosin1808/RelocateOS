"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { signOutUser } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/scout", label: "Job Scout", icon: Briefcase },
  { href: "/applications", label: "Applications", icon: CalendarCheck },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/profile", label: "Candidate Profile", icon: UserRound },
  { href: "/relocation", label: "Relocation Planner", icon: Gauge },
  { href: "/automation", label: "Automation", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="fixed top-3 left-3 z-40 rounded-control border border-border bg-surface p-2 text-ink-muted md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
      >
        {open ? <X className="size-4" /> : <span className="block h-0.5 w-4 bg-current" />}
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-ink/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border bg-surface",
          "transition-transform duration-150 max-md:-translate-x-full",
          open && "max-md:translate-x-0",
          className,
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="flex size-6 items-center justify-center rounded-[5px] bg-accent text-[0.6875rem] font-bold text-white">
            R
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight">RelocateOS</span>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[0.8125rem] font-medium transition-colors duration-150",
                  active
                    ? "bg-accent-subtle text-accent"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="size-3.5" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
