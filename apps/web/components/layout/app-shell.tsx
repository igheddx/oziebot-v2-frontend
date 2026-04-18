"use client";

import Link from "next/link";

import { MobileTabbar } from "@/components/nav/mobile-tabbar";
import { ModeToggle } from "@/components/dashboard/mode-toggle";
import { useAuth } from "@/components/providers/auth-provider";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showModeToggle?: boolean;
};

export function AppShell({ title, subtitle, children, showModeToggle = true }: AppShellProps) {
  const { logoutUser } = useAuth();

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-24 pt-4 sm:px-6">
      <header className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Oziebot</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/onboarding" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted">
              Setup
            </Link>
            <button
              type="button"
              onClick={() => {
                void logoutUser();
              }}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted"
            >
              Logout
            </button>
          </div>
        </div>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        {showModeToggle ? <ModeToggle /> : null}
      </header>
      <main className="space-y-4">{children}</main>
      <MobileTabbar />
    </div>
  );
}
