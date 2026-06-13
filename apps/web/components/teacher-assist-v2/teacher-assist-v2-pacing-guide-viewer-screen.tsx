"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  archiveV2PacingGuide,
  cloneV2PacingGuide,
  fetchV2PacingGuide,
  updateV2PacingGuidePeriod,
} from "@/lib/teacher-assist-v2-api";
import type { PacingGuideDetail } from "@/lib/teacher-assist-v2-types";
import { PacingGuideSupportingMaterialsPanel } from "@/components/teacher-assist-v2/pacing-guide-supporting-materials-panel";

export function TeacherAssistV2PacingGuideViewerScreen({ guideId: guideIdProp }: { guideId?: string } = {}) {
  const searchParams = useSearchParams();
  const guideId = guideIdProp ?? searchParams.get("id") ?? "";
  const [guide, setGuide] = useState<PacingGuideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, { title: string; description: string }>>({});

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchV2PacingGuide(guideId);
      setGuide(next);
      setEditForms(
        Object.fromEntries(
          next.periods.map((period) => [
            period.id,
            { title: period.title, description: period.description ?? "" },
          ]),
        ),
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load pacing guide.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!guideId) return;
    void refresh();
  }, [guideId]);

  if (!guideId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No pacing guide selected.{" "}
        <Link href="/teacher-assist-v2/admin/pacing-guides" className="font-semibold text-sky-700">
          Return to the list
        </Link>
        .
      </div>
    );
  }

  if (loading) return <p className="text-sm text-slate-600">Loading pacing guide...</p>;
  if (!guide) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error ?? "Pacing guide not found."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/admin/pacing-guides" className="text-xs font-semibold text-sky-700">
          ← Back to pacing guides
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{guide.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{guide.description}</p>
        <p className="mt-1 text-xs text-slate-500">
          {guide.school_year_label ?? "School year"} · {guide.period_count} instructional weeks
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/teacher-assist-v2/admin/pacing-guides/edit/?id=${encodeURIComponent(guide.id)}`}
            className="ta-button-primary inline-flex h-8 items-center px-3 text-xs"
          >
            Edit in builder
          </Link>
          <button
            type="button"
            className="ta-button-secondary h-8 px-3 text-xs"
            onClick={() => {
              void cloneV2PacingGuide(guide.id, { title: `${guide.title} Copy` })
                .then(() => setMessage("Clone created. Return to the list to open it."))
                .catch((nextError: Error) => setError(nextError.message));
            }}
          >
            Clone guide
          </button>
          {guide.is_active ? (
            <button
              type="button"
              className="ta-button-secondary h-8 px-3 text-xs"
              onClick={() => {
                void archiveV2PacingGuide(guide.id)
                  .then(() => setMessage("Guide archived."))
                  .catch((nextError: Error) => setError(nextError.message));
              }}
            >
              Archive guide
            </button>
          ) : null}
        </div>
      </header>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="space-y-2">
        {guide.periods.map((period) => {
          const expanded = expandedPeriodId === period.id;
          return (
            <article key={period.id} className="rounded-xl border border-slate-200 bg-white/80">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpandedPeriodId(expanded ? null : period.id)}
              >
                <div>
                  <p className="font-medium text-slate-900">{period.title}</p>
                  <p className="text-xs text-slate-500">
                    {period.objectives.length} mapped objective{period.objectives.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{expanded ? "Hide" : "Show"}</span>
              </button>
              {expanded ? (
                <div className="border-t border-slate-100 px-4 py-3">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Week title</span>
                    <input
                      className="ta-input h-9"
                      value={editForms[period.id]?.title ?? period.title}
                      onChange={(event) =>
                        setEditForms((current) => ({
                          ...current,
                          [period.id]: { ...current[period.id], title: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="mt-2 block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Daily instructional expectations</span>
                    <textarea
                      className="ta-input min-h-[96px]"
                      value={editForms[period.id]?.description ?? period.description ?? ""}
                      onChange={(event) =>
                        setEditForms((current) => ({
                          ...current,
                          [period.id]: { ...current[period.id], description: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="ta-button-primary mt-3 h-8 px-3 text-xs"
                    onClick={() => {
                      const form = editForms[period.id];
                      if (!form) return;
                      void updateV2PacingGuidePeriod(period.id, {
                        title: form.title.trim(),
                        description: form.description.trim() || null,
                      })
                        .then(async (updated) => {
                          setGuide(updated);
                          setMessage("Week updated.");
                        })
                        .catch((nextError: Error) => setError(nextError.message));
                    }}
                  >
                    Save week
                  </button>
                  {period.objectives.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {period.objectives.map((objective) => (
                        <li key={objective.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <span className="font-semibold">{objective.objective_code}</span>
                          {objective.objective_description ? ` — ${objective.objective_description}` : null}
                          <PacingGuideSupportingMaterialsPanel
                            pacingGuideId={guide.id}
                            periodId={period.id}
                            educationObjectiveId={objective.objective_id}
                            scopeLabel={`Objective ${objective.objective_code ?? ""} materials`}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <PacingGuideSupportingMaterialsPanel
                    pacingGuideId={guide.id}
                    periodId={period.id}
                    weekLevelOnly
                    scopeLabel={`${period.title} week materials`}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
