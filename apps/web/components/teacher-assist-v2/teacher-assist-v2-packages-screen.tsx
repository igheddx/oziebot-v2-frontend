"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { InstructionalPackageCard } from "@/components/teacher-assist-v2/instructional-package-card";
import { fetchV2InstructionalPackages, fetchV2TeacherHome } from "@/lib/teacher-assist-v2-api";
import type { InstructionalPackageSummary, TeacherHomeSummary } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2PackagesScreen() {
  const [packages, setPackages] = useState<InstructionalPackageSummary[]>([]);
  const [home, setHome] = useState<TeacherHomeSummary | null>(null);
  const [status, setStatus] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => ["", "active", "generated", "ending_soon", "expired", "completed"],
    [],
  );

  useEffect(() => {
    void fetchV2TeacherHome()
      .then(setHome)
      .catch(() => setHome(null));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchV2InstructionalPackages({
          status: status || undefined,
          subject_id: subjectId || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        setPackages(rows);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not load packages.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [status, subjectId, dateFrom, dateTo]);

  return (
    <div className="max-w-4xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/home" className="text-xs font-semibold text-sky-700">
          ← Back to home
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Instructional packages</h1>
        <p className="mt-1 text-sm text-slate-600">Review generated plans, track dates, and close out completed teaching.</p>
      </header>

      {home?.active_pacing_guides && home.active_pacing_guides.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Active pacing guides</h2>
            <Link href="/teacher-assist-v2/pacing-guide-setup" className="text-xs font-semibold text-sky-700">
              View all available guides
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {home.active_pacing_guides.map((guide) => (
              <li key={guide.subject_id} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-900">{guide.subject_name}</span>
                <span className="text-slate-500"> — {guide.pacing_guide_title}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Packages and planning use your selected pacing guides. Choose a different guide on the Pacing Guides page.
          </p>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Status</span>
          <select className="ta-input h-9" value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option || "all"} value={option}>
                {option ? option.replaceAll("_", " ") : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">School year</span>
          <input className="ta-input h-9" value={home?.school_year_title ?? "—"} readOnly />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Subject</span>
          <select className="ta-input h-9" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">All subjects</option>
            {(home?.subjects ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Plan ends on or after</span>
          <input className="ta-input h-9" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Plan starts on or before</span>
          <input className="ta-input h-9" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {loading ? <p className="text-sm text-slate-600">Loading packages...</p> : null}

      {!loading && packages.length === 0 ? (
        <p className="text-sm text-slate-600">No packages match these filters.</p>
      ) : null}

      <div className="space-y-3">
        {packages.map((pkg) => (
          <InstructionalPackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </div>
  );
}
