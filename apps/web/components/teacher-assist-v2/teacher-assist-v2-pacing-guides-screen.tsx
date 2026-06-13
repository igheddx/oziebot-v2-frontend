"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { archiveV2PacingGuide, cloneV2PacingGuide, fetchV2Districts, fetchV2PacingGuides } from "@/lib/teacher-assist-v2-api";
import type { EducationDistrictRow, PacingGuideSummary } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2PacingGuidesScreen() {
  const [districts, setDistricts] = useState<EducationDistrictRow[]>([]);
  const [filterDistrictId, setFilterDistrictId] = useState("");
  const [guides, setGuides] = useState<PacingGuideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setGuides(await fetchV2PacingGuides(filterDistrictId || undefined));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load pacing guides.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchV2Districts(undefined, true).then((rows) => {
      setDistricts(rows);
      const lisd = rows.find((row) => row.district_code === "LISD") ?? rows[0];
      if (lisd) setFilterDistrictId(lisd.id);
    });
  }, []);

  useEffect(() => {
    if (filterDistrictId) void refresh();
  }, [filterDistrictId]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pacing Guides</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create district or school pacing guides linked to catalog scope, objectives, weekly plans, and resources.
          </p>
        </div>
        <Link href="/teacher-assist-v2/admin/pacing-guides/create" className="ta-button-primary inline-flex h-9 items-center px-3 text-sm">
          Create new pacing guide
        </Link>
      </header>

      <label className="block max-w-xs space-y-1 text-sm">
        <span className="font-medium text-slate-700">District</span>
        <select className="ta-input h-9" value={filterDistrictId} onChange={(e) => setFilterDistrictId(e.target.value)}>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </label>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Guide</th>
              <th className="px-4 py-2">Scope</th>
              <th className="px-4 py-2">School year</th>
              <th className="px-4 py-2">Grade / Subject</th>
              <th className="px-4 py-2">Weeks</th>
              <th className="px-4 py-2">Objectives</th>
              <th className="px-4 py-2">Resources</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : guides.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-500">
                  No pacing guides found for this district. Create one to get started.
                </td>
              </tr>
            ) : (
              guides.map((guide) => (
                <tr key={guide.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{guide.title}</p>
                    {guide.description ? <p className="text-xs text-slate-500">{guide.description}</p> : null}
                  </td>
                  <td className="px-4 py-3">{guide.scope_label ?? "District"}</td>
                  <td className="px-4 py-3">{guide.school_year_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    {[guide.grade_name, guide.subject_name].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">{guide.period_count}</td>
                  <td className="px-4 py-3">{guide.objective_count ?? 0}</td>
                  <td className="px-4 py-3">{guide.resource_count ?? 0}</td>
                  <td className="px-4 py-3">{guide.is_active ? "Active" : "Archived"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/teacher-assist-v2/admin/pacing-guides/view/?id=${encodeURIComponent(guide.id)}`}
                        className="ta-button-primary inline-flex h-8 items-center px-2 text-xs"
                      >
                        Open
                      </Link>
                      <Link
                        href={`/teacher-assist-v2/admin/pacing-guides/edit/?id=${encodeURIComponent(guide.id)}`}
                        className="ta-button-secondary inline-flex h-8 items-center px-2 text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="ta-button-secondary h-8 px-2 text-xs"
                        onClick={() => {
                          void cloneV2PacingGuide(guide.id, { title: `${guide.title} Copy` })
                            .then(() => {
                              setMessage("Pacing guide duplicated.");
                              return refresh();
                            })
                            .catch((nextError: Error) => setError(nextError.message));
                        }}
                      >
                        Duplicate
                      </button>
                      {guide.is_active ? (
                        <button
                          type="button"
                          className="ta-button-secondary h-8 px-2 text-xs"
                          onClick={() => {
                            void archiveV2PacingGuide(guide.id)
                              .then(() => {
                                setMessage("Pacing guide archived.");
                                return refresh();
                              })
                              .catch((nextError: Error) => setError(nextError.message));
                          }}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
