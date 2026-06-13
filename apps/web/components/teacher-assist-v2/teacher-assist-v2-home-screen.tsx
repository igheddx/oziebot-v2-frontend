"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InstructionalPackageCard } from "@/components/teacher-assist-v2/instructional-package-card";
import { fetchV2TeacherHome } from "@/lib/teacher-assist-v2-api";
import type { InstructionalPackageSummary, TeacherHomeSummary } from "@/lib/teacher-assist-v2-types";

function PackageSection({
  title,
  packages,
  empty,
}: {
  title: string;
  packages: InstructionalPackageSummary[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {packages.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {packages.map((pkg) => (
            <InstructionalPackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </section>
  );
}

export function TeacherAssistV2HomeScreen() {
  const [summary, setSummary] = useState<TeacherHomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2TeacherHome()
      .then(setSummary)
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-600">Loading your workspace...</p>;
  if (!summary) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error ?? "Could not load home."}
      </div>
    );
  }

  const dashboard = summary.package_dashboard;

  return (
    <div className="max-w-3xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Teacher dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track instructional packages, pacing guides, and your current teaching plans.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">School year</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{summary.school_year_title ?? "—"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grade</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{summary.grade_name ?? "—"}</p>
        </article>
      </section>


      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent grades confirmed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.recent_grades_confirmed_count ?? 0}</p>
          <Link href="/teacher-assist-v2/gradebook" className="mt-2 inline-flex text-sm font-semibold text-sky-700">
            Open gradebook
          </Link>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objectives assessed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.objectives_assessed_count ?? 0}</p>
          <Link href="/teacher-assist-v2/mastery" className="mt-2 inline-flex text-sm font-semibold text-sky-700">
            View mastery
          </Link>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Mastery alerts</p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">{summary.mastery_alerts_count ?? 0}</p>
          <p className="mt-2 text-xs text-amber-900">Students at beginning level on confirmed evidence.</p>
        </article>
      </section>

      {(summary.assignments_requiring_review_count ?? 0) > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Assignments requiring review</p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">{summary.assignments_requiring_review_count}</p>
          <Link href="/teacher-assist-v2/assignments" className="mt-2 inline-flex text-sm font-semibold text-sky-700">
            Open assignments
          </Link>
        </section>
      ) : null}

      {dashboard?.current_package ? (
        <PackageSection title="Current instructional package" packages={[dashboard.current_package]} empty="" />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Current instructional package</h2>
          <p className="mt-2 text-sm text-slate-600">No active package for today. Generate a plan or open an upcoming package.</p>
        </section>
      )}

      <PackageSection
        title="Upcoming packages"
        packages={dashboard?.upcoming_packages ?? []}
        empty="No upcoming packages."
      />
      <PackageSection
        title="Ending soon"
        packages={dashboard?.ending_soon_packages ?? []}
        empty="No plans ending within the next 3 days."
      />
      <PackageSection
        title="Expired / needs close-out"
        packages={dashboard?.expired_packages ?? []}
        empty="No expired packages waiting for close-out."
      />
      <PackageSection
        title="Recently generated"
        packages={dashboard?.recently_generated_packages ?? []}
        empty="Generate your first instructional package to see it here."
      />

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Recent assignments</h2>
          <Link href="/teacher-assist-v2/assignments" className="text-xs font-semibold text-sky-700">
            View all
          </Link>
        </div>
        {(summary.recent_assignments ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Generate a package with quiz or written assignment outputs to see assignments here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(summary.recent_assignments ?? []).map((assignment) => (
              <li key={assignment.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <Link
                  href={`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(assignment.id)}`}
                  className="font-medium text-sky-700"
                >
                  {assignment.title}
                </Link>
                <p className="mt-1 text-xs text-slate-600">
                  {assignment.assignment_type.replaceAll("_", " ")} · {assignment.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/teacher-assist-v2/planning" className="ta-button-primary inline-flex h-10 items-center px-4 text-sm">
          Start Planning
        </Link>
        <Link href="/teacher-assist-v2/packages" className="ta-button-secondary inline-flex h-10 items-center px-4 text-sm">
          All packages
        </Link>
      </div>
    </div>
  );
}
