"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchV2AdminDashboard } from "@/lib/teacher-assist-v2-api";
import type { AdminDashboard } from "@/lib/teacher-assist-v2-types";

const LINKS = [
  { href: "/teacher-assist-v2/admin/states", label: "States", metric: "states" as const },
  { href: "/teacher-assist-v2/admin/districts", label: "Districts", metric: "districts" as const },
  { href: "/teacher-assist-v2/admin/schools", label: "Schools", metric: "schools" as const },
  { href: "/teacher-assist-v2/admin/grades", label: "Grades", metric: "grades" as const },
  { href: "/teacher-assist-v2/admin/subjects", label: "Subjects", metric: "subjects" as const },
];

const INSTRUCTIONAL_LINKS = [
  { href: "/teacher-assist-v2/admin/school-years", label: "School Years" },
  { href: "/teacher-assist-v2/admin/objectives", label: "Learning Objectives" },
  { href: "/teacher-assist-v2/admin/pacing-guides", label: "Pacing Guides" },
];

export function TeacherAssistV2AdminDashboardScreen() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2AdminDashboard()
      .then(setDashboard)
      .catch((nextError: Error) => setError(nextError.message));
  }, []);

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Root Admin</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Academic hierarchy</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage the educational structure before teachers, objectives, or pacing guides are added.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 transition hover:border-sky-200"
          >
            <p className="text-sm font-semibold text-slate-900">{link.label}</p>
            <p className="mt-1 text-2xl font-bold text-sky-700">{dashboard ? dashboard[link.metric] : "—"}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {INSTRUCTIONAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 transition hover:border-sky-300"
          >
            <p className="text-sm font-semibold text-sky-900">{link.label}</p>
            <p className="mt-1 text-xs text-sky-800">Instructional foundation</p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <p className="text-sm font-semibold text-sky-900">Hierarchy Explorer</p>
        <p className="mt-1 text-sm text-sky-800">
          Review the full state → district → school → grade → subject tree.
        </p>
        <Link href="/teacher-assist-v2/admin/hierarchy" className="ta-button-primary mt-3 inline-flex h-9 text-sm">
          Open explorer
        </Link>
      </section>
    </div>
  );
}
