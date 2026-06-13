"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import {
  ApiFieldErrors,
  fetchV2PacingGuideSetupForm,
  saveV2PacingGuideSetup,
} from "@/lib/teacher-assist-v2-api";
import type { PacingGuideSetupForm } from "@/lib/teacher-assist-v2-types";

type SubjectSelection = {
  source_guide_id: string;
  mode: "district" | "teacher_copy";
};

const NO_PACING_GUIDE_OPTION = "";

function resolveInitialSelection(
  subject: PacingGuideSetupForm["subjects"][number],
  existing: PacingGuideSetupForm["existing_assignments"][number] | undefined,
): SubjectSelection {
  if (existing) {
    const pickGuideId = (candidateId: string | null | undefined) => {
      if (candidateId && subject.available_guides.some((guide) => guide.id === candidateId)) {
        return candidateId;
      }
      return NO_PACING_GUIDE_OPTION;
    };
    return {
      source_guide_id: pickGuideId(existing.source_district_guide_id ?? existing.pacing_guide_id),
      mode: existing.guide_scope === "teacher" ? "teacher_copy" : "district",
    };
  }

  return { source_guide_id: NO_PACING_GUIDE_OPTION, mode: "district" };
}

function ensureDistrictGuideSelection(
  subject: PacingGuideSetupForm["subjects"][number],
  current: SubjectSelection | undefined,
): SubjectSelection {
  const firstGuide = subject.available_guides[0];
  const sourceGuideId =
    current?.source_guide_id &&
    subject.available_guides.some((guide) => guide.id === current.source_guide_id)
      ? current.source_guide_id
      : (firstGuide?.id ?? "");
  return { source_guide_id: sourceGuideId, mode: "district" };
}

export function TeacherAssistV2PacingGuideSetupScreen() {
  const router = useRouter();
  const { refresh } = useTeacherAssistV2();
  const [form, setForm] = useState<PacingGuideSetupForm | null>(null);
  const [selections, setSelections] = useState<Record<string, SubjectSelection>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchV2PacingGuideSetupForm()
      .then((payload) => {
        setForm(payload);
        const initial: Record<string, SubjectSelection> = {};
        for (const subject of payload.subjects) {
          const existing = payload.existing_assignments.find((row) => row.subject_id === subject.id);
          initial[subject.id] = resolveInitialSelection(subject, existing);
        }
        setSelections(initial);
      })
      .catch((error: Error) => setFormError(error.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-600">Loading pacing guides...</p>;
  if (!form) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {formError ?? "Could not load pacing guide setup."}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">
          {form.setup_complete ? "Your pacing guides" : "Set up your pacing guides"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {form.setup_complete
            ? "Choose which district or school pacing guide to use for each subject. Subjects left on No option are excluded from planning."
            : "Choose a district pacing guide for subjects you want in your plans, or leave No option to skip a subject. You can copy a guide to create your own editable version."}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {form.school_year_title} · Grade level guides — coming later
        </p>
      </header>

      {formError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</div>
      ) : null}
      {fieldErrors.selections ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {fieldErrors.selections}
        </div>
      ) : null}

      <div className="space-y-3">
        {form.subjects.map((subject) => {
          const selection = selections[subject.id];
          return (
            <article key={subject.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <h2 className="text-sm font-semibold text-slate-900">{subject.display_name}</h2>
              {subject.available_guides.length === 0 ? (
                <p className="mt-2 text-sm text-amber-800">
                  No district pacing guide is available for this subject. It will be excluded from planning until a guide
                  is published.
                </p>
              ) : (
                <>
                  <label className="mt-3 block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">District pacing guide</span>
                    <select
                      className="ta-input h-9"
                      value={selection?.source_guide_id ?? NO_PACING_GUIDE_OPTION}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [subject.id]: {
                            source_guide_id: event.target.value,
                            mode: current[subject.id]?.mode ?? "district",
                          },
                        }))
                      }
                    >
                      <option value={NO_PACING_GUIDE_OPTION}>No option</option>
                      {subject.available_guides.map((guide) => (
                        <option key={guide.id} value={guide.id}>
                          {guide.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selection?.source_guide_id ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`h-9 rounded-xl px-3 text-xs font-semibold ${
                          selection?.mode === "district"
                            ? "bg-sky-600 text-white"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}
                        onClick={() =>
                          setSelections((current) => ({
                            ...current,
                            [subject.id]: ensureDistrictGuideSelection(subject, current[subject.id]),
                          }))
                        }
                      >
                        Use district guide
                      </button>
                      <button
                        type="button"
                        className={`h-9 rounded-xl px-3 text-xs font-semibold ${
                          selection?.mode === "teacher_copy"
                            ? "bg-sky-600 text-white"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}
                        onClick={() =>
                          setSelections((current) => ({
                            ...current,
                            [subject.id]: { ...current[subject.id], mode: "teacher_copy" },
                          }))
                        }
                      >
                        Copy to my guide
                      </button>
                      <button
                        type="button"
                        disabled
                        className="h-9 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-400"
                        title="Coming later"
                      >
                        Copy to grade guide — coming later
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">This subject will not be included in lesson planning.</p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="ta-button-primary h-10 px-4 text-sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFormError(null);
          setFieldErrors({});
          const payload = form.subjects
            .filter((subject) => selections[subject.id]?.source_guide_id)
            .map((subject) => ({
              subject_id: subject.id,
              source_guide_id: selections[subject.id].source_guide_id,
              mode: selections[subject.id].mode,
            }));
          if (payload.length === 0) {
            setFieldErrors({ selections: "Select at least one pacing guide to include in planning." });
            setBusy(false);
            return;
          }
          void saveV2PacingGuideSetup({ selections: payload })
            .then(async (result) => {
              await refresh();
              router.replace(result.landing_route);
            })
            .catch((error: Error) => {
              if (error instanceof ApiFieldErrors) {
                setFieldErrors(error.fieldErrors);
                return;
              }
              setFormError(error.message);
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Saving..." : form.setup_complete ? "Save pacing guide choices" : "Finish pacing guide setup"}
      </button>
    </div>
  );
}
