"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppSwitcher } from "@/components/platform/app-switcher";
import { useAuth } from "@/components/providers/auth-provider";
import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import {
  TEACHER_ASSIST_V2_ROOT_ADMIN_NAV,
  TEACHER_ASSIST_V2_TEACHER_NAV,
} from "@/components/teacher-assist-v2/teacher-assist-v2-nav";

function navClass(active: boolean, primary: boolean) {
  const base = primary
    ? "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition"
    : "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition";
  if (active) {
    return `${base} border border-sky-300 bg-sky-600 text-white shadow-sm`;
  }
  return primary
    ? `${base} border border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50`
    : `${base} border border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200`;
}

function normalizeRoute(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isAllowedTeacherRoute(pathname: string, allowedRoutes: string[]): boolean {
  const normalized = normalizeRoute(pathname);
  return allowedRoutes.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

function V2Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { context, loading, error } = useTeacherAssistV2();
  const [lockNotice, setLockNotice] = useState(false);

  useEffect(() => {
    if (loading || !context) return;
    if (!context.has_access && pathname !== "/teacher-assist-v2/access-denied") {
      router.replace("/teacher-assist-v2/access-denied");
      return;
    }
    if (pathname === "/teacher-assist-v2" && context.landing_route !== pathname) {
      router.replace(context.landing_route);
      return;
    }
    if (context.role === "root_admin") {
      if (
        pathname.startsWith("/teacher-assist-v2/onboarding") ||
        pathname.startsWith("/teacher-assist-v2/home") ||
        pathname.startsWith("/teacher-assist-v2/reset-password") ||
        pathname.startsWith("/teacher-assist-v2/pacing-guide-setup")
      ) {
        router.replace("/teacher-assist-v2/admin");
      }
      return;
    }
    if (context.role === "teacher" && pathname.startsWith("/teacher-assist-v2/admin")) {
      router.replace(context.landing_route);
      return;
    }
    if (context.role === "teacher" && context.feature_locked) {
      const allowed = context.allowed_routes ?? [];
      if (!isAllowedTeacherRoute(pathname, allowed)) {
        setLockNotice(true);
        router.replace(context.landing_route);
      } else {
        setLockNotice(false);
      }
    }
  }, [context, loading, pathname, router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading TeacherAssist...</p>;
  }
  if (error) {
    return (
      <div className="ta-panel border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  return (
    <>
      {lockNotice && context?.feature_lock_message ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {context.feature_lock_message}
        </div>
      ) : null}
      {children}
    </>
  );
}

export function TeacherAssistV2Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logoutUser, user } = useAuth();
  const { context, processingIndicator } = useTeacherAssistV2();
  const isPresentationRoute = pathname.startsWith("/teacher-assist-v2/teach");
  const isRootAdmin = context?.role === "root_admin";
  const isTeacher = context?.role === "teacher";
  const showTeacherNav = isTeacher && !context?.feature_locked;
  const nav = isRootAdmin ? TEACHER_ASSIST_V2_ROOT_ADMIN_NAV : TEACHER_ASSIST_V2_TEACHER_NAV;
  const primaryNav = showTeacherNav || isRootAdmin
    ? nav.filter((item) => item.href !== "/teacher-assist-v2/admin/settings")
    : [];
  const secondaryNav = isRootAdmin ? nav.filter((item) => item.href === "/teacher-assist-v2/admin/settings") : [];

  if (isPresentationRoute) {
    return (
      <div className="teacher-assist-theme min-h-dvh bg-background text-foreground">
        <V2Gate>{children}</V2Gate>
      </div>
    );
  }

  return (
    <div className="teacher-assist-theme min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[color-mix(in_srgb,var(--background)_92%,white)] pb-3 pt-1 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/teacher-assist-v2" className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              TeacherAssist
            </Link>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800">
              v2
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {processingIndicator ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-800">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                  <span>{processingIndicator.label}</span>
                </div>
              ) : null}
              <AppSwitcher />
              <div className="hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-xs font-semibold text-slate-900">{user?.full_name ?? "User"}</p>
                <p className="max-w-[180px] truncate text-[11px] text-slate-500">{context?.role ?? "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => void logoutUser()}
                className="ta-button-secondary h-8 px-3 text-xs"
              >
                Logout
              </button>
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Primary">
            {primaryNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={navClass(active, true)}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {secondaryNav.length > 0 ? (
            <nav className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2" aria-label="Secondary">
              {secondaryNav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={navClass(active, false)}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </header>
        <main className="flex-1 py-6 text-left">
          <V2Gate>{children}</V2Gate>
        </main>
      </div>
    </div>
  );
}
