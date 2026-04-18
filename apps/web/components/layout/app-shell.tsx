"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { MobileTabbar } from "@/components/nav/mobile-tabbar";
import { ModeBadge, ModeToggle } from "@/components/dashboard/mode-toggle";
import { useAuth } from "@/components/providers/auth-provider";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showModeToggle?: boolean;
};

export function AppShell({ title, subtitle, children, showModeToggle = true }: AppShellProps) {
  const { logoutUser, role } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isRootAdmin = role === "root_admin";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryString = searchParams.toString();
  const navLinks = useMemo(
    () =>
      [
        ...(isRootAdmin
          ? [
              { href: "/admin/token-policy", label: "Admin" },
              { href: "/admin/fee-settings", label: "Fee Settings" },
            ]
          : []),
        { href: "/onboarding", label: "Setup" },
      ].map((item) => ({
        ...item,
        href: queryString ? `${item.href}?${queryString}` : item.href,
      })),
    [isRootAdmin, queryString],
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, queryString]);

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-24 pt-4 sm:px-6">
      <header className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Oziebot</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {showModeToggle ? <ModeBadge /> : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="app-shell-menu"
              aria-label="Open menu"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/80 text-muted"
            >
              <span className="sr-only">Open menu</span>
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </div>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </header>
      <main className="space-y-4">{children}</main>
      {drawerOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id="app-shell-menu"
            className="absolute inset-y-0 right-0 flex w-full max-w-xs flex-col gap-4 border-l border-border bg-background p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Menu</p>
                <p className="text-sm text-muted">Quick actions and mode controls.</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/80 text-lg text-muted"
              >
                ×
              </button>
            </div>
            {showModeToggle ? <ModeToggle variant="drawer" /> : null}
            <nav className="space-y-2">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-12 items-center rounded-2xl border border-border px-4 text-sm font-semibold text-foreground"
                  onClick={() => setDrawerOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                void logoutUser();
              }}
              className="mt-auto flex h-12 items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold text-muted"
            >
              Logout
            </button>
          </aside>
        </div>
      ) : null}
      {drawerOpen ? null : <MobileTabbar />}
    </div>
  );
}
