import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar, TopbarFallback } from "@/components/layout/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div className="fixed inset-y-0 left-0 w-56 border-r border-border bg-surface" />}>
        <Sidebar />
      </Suspense>
      <div className="md:pl-56">
        <Suspense fallback={<TopbarFallback />}>
          <Topbar />
        </Suspense>
        <main className="mx-auto w-full max-w-[1360px] px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
