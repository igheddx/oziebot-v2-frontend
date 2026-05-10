"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { MobileTabbar } from "@/components/nav/mobile-tabbar";
import {
  ADMIN_NAV_LINKS,
  PRIMARY_NAV_LINKS,
  SECONDARY_NAV_LINKS,
} from "@/components/nav/app-nav-links";
import { ModeBadge, ModeToggle } from "@/components/dashboard/mode-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import logo from "@/images/oziebot-logo.png";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showModeToggle?: boolean;
};

export function AppShell({ title, subtitle, children, showModeToggle = true }: AppShellProps) {
  const { logoutUser, role, user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isRootAdmin = role === "root_admin";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryString = searchParams.toString();
  const primaryLinks = useMemo(
    () =>
      PRIMARY_NAV_LINKS.map((item) => ({
        ...item,
        href: queryString ? `${item.href}?${queryString}` : item.href,
      })),
    [queryString],
  );
  const secondaryLinks = useMemo(
    () =>
      SECONDARY_NAV_LINKS.map((item) => ({
        ...item,
        href: queryString ? `${item.href}?${queryString}` : item.href,
      })),
    [queryString],
  );
  const adminLinks = useMemo(
    () =>
      (isRootAdmin ? ADMIN_NAV_LINKS : []).map((item) => ({
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
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6 md:pb-8 lg:px-8">
      <header className="sticky top-0 z-30 mb-4 sm:mb-6">
        <div className="oz-panel border-border/80 bg-background/90 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur sm:px-5">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <Link href={queryString ? `/dashboard?${queryString}` : "/dashboard"} className="inline-flex shrink-0">
              <Image
                src={logo}
                alt="Oziebot"
                priority
                className="h-auto w-20 sm:w-24 lg:w-28"
                sizes="(min-width: 1024px) 112px, (min-width: 640px) 96px, 80px"
              />
            </Link>
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

          <div className="mt-3 border-t border-border/80 pt-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-muted sm:text-[15px]">{subtitle}</p>
            ) : null}
            <nav className="mt-4 hidden md:flex md:flex-wrap md:gap-2">
              {primaryLinks.map((item) => {
                const active = pathname === item.href.split("?")[0];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition ${
                      active
                        ? "border-border bg-card text-foreground"
                        : "border-border/80 text-muted hover:bg-card/70 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
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
            className="absolute inset-y-0 right-0 flex h-full w-full max-w-xs flex-col overflow-hidden border-l border-border bg-background p-4 shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Menu</p>
                <p className="text-sm font-medium text-foreground">{user?.full_name ?? user?.email ?? "Oziebot"}</p>
                {user?.full_name ? <p className="text-xs text-muted">{user.email}</p> : null}
                <p className="mt-1 text-sm text-muted">Quick actions and mode controls.</p>
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
            {showModeToggle ? (
              <div className="shrink-0 pt-4">
                <ModeToggle variant="drawer" />
              </div>
            ) : null}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pt-4 pr-1">
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Navigation
                </p>
                <nav className="space-y-2">
                  {primaryLinks.map((item) => (
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
              </div>
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Tools
                </p>
                <nav className="space-y-2">
                  {secondaryLinks.map((item) => (
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
              </div>
              {adminLinks.length ? (
                <div className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Admin
                  </p>
                  <nav className="space-y-2">
                    {adminLinks.map((item) => (
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
                </div>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-border/80 pt-4">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  void logoutUser();
                }}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold text-muted"
              >
                Logout
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      {drawerOpen ? null : <MobileTabbar />}
    </div>
  );
}
