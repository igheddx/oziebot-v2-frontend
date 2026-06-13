"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import {
  ApiFieldErrors,
  fetchV2TeacherOnboardingForm,
  saveV2TeacherOnboarding,
} from "@/lib/teacher-assist-v2-api";
import type { TeacherOnboardingForm } from "@/lib/teacher-assist-v2-types";

const STEPS = ["School year", "Grade", "Class size", "Subjects"] as const;

export function TeacherAssistV2OnboardingScreen() {
  const router = useRouter();
  const { refresh } = useTeacherAssistV2();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TeacherOnboardingForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [schoolYearId, setSchoolYearId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [studentCount, setStudentCount] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  useEffect(() => {
    void fetchV2TeacherOnboardingForm()
      .then((payload) => {
        setForm(payload);
        setSchoolYearId(payload.selected_school_year_id ?? payload.default_school_year_id ?? "");
        setGradeId(payload.selected_grade_id ?? payload.assigned_grade_id ?? "");
        setStudentCount(payload.student_count != null ? String(payload.student_count) : "");
        setSubjectIds(payload.selected_subject_ids ?? []);
      })
      .catch((error: Error) => setFormError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (step !== 3 || !gradeId) return;
    void fetchV2TeacherOnboardingForm(gradeId)
      .then((payload) => {
        setForm((current) => (current ? { ...current, subjects: payload.subjects } : payload));
        setSubjectIds((current) => current.filter((id) => payload.subjects.some((subject) => subject.id === id)));
      })
      .catch(() => {
        /* keep existing subjects */
      });
  }, [gradeId, step]);

  const subjectsForGrade = useMemo(() => form?.subjects ?? [], [form?.subjects]);

  const validateStep = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (step === 0 && !schoolYearId) errors.school_year_id = "Choose your school year.";
    if (step === 1 && !gradeId) errors.grade_id = "Choose your grade.";
    if (step === 2) {
      const count = Number(studentCount);
      if (!studentCount.trim()) errors.student_count = "Enter your class size.";
      else if (!Number.isFinite(count) || count < 1 || count > 100) {
        errors.student_count = "Enter a class size between 1 and 100.";
      }
    }
    if (step === 3 && subjectIds.length === 0) {
      errors.selected_subject_ids = "Select at least one subject you teach.";
    }
    return errors;
  };

  if (loading) return <p className="text-sm text-slate-600">Loading onboarding...</p>;
  if (!form) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {formError ?? "Could not load onboarding."}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Welcome to TeacherAssist</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tell us about your classroom at {form.assignment.school_name}. This takes about two minutes.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              index === step
                ? "bg-sky-600 text-white"
                : index < step
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {formError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        {step === 0 ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">School year</span>
            <select
              className={`ta-input h-9 ${fieldErrors.school_year_id ? "ta-input-error" : ""}`}
              value={schoolYearId}
              onChange={(event) => setSchoolYearId(event.target.value)}
            >
              <option value="">Select school year...</option>
              {form.school_years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.title}
                  {year.active ? " (active)" : ""}
                </option>
              ))}
            </select>
            {fieldErrors.school_year_id ? (
              <span className="ta-field-error">{fieldErrors.school_year_id}</span>
            ) : null}
          </label>
        ) : null}

        {step === 1 ? (
          <div className="space-y-2">
            {form.assigned_grade_id ? (
              <p className="text-sm text-slate-600">
                Your administrator assigned a grade. Confirm it matches your classroom.
              </p>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Grade</span>
              <select
                className={`ta-input h-9 ${fieldErrors.grade_id ? "ta-input-error" : ""}`}
                value={gradeId}
                onChange={(event) => setGradeId(event.target.value)}
              >
                <option value="">Select grade...</option>
                {form.grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.display_name}
                  </option>
                ))}
              </select>
              {fieldErrors.grade_id ? <span className="ta-field-error">{fieldErrors.grade_id}</span> : null}
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">How many students are in your class?</span>
            <input
              type="number"
              min={1}
              max={100}
              className={`ta-input h-9 ${fieldErrors.student_count ? "ta-input-error" : ""}`}
              value={studentCount}
              onChange={(event) => setStudentCount(event.target.value)}
            />
            {fieldErrors.student_count ? (
              <span className="ta-field-error">{fieldErrors.student_count}</span>
            ) : null}
          </label>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Select the subjects you teach this year.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {subjectsForGrade.map((subject) => {
                const checked = subjectIds.includes(subject.id);
                return (
                  <label
                    key={subject.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      checked ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSubjectIds((current) =>
                          checked ? current.filter((id) => id !== subject.id) : [...current, subject.id],
                        )
                      }
                    />
                    <span className="font-medium text-slate-800">{subject.display_name}</span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.selected_subject_ids ? (
              <span className="ta-field-error">{fieldErrors.selected_subject_ids}</span>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex gap-2">
        {step > 0 ? (
          <button
            type="button"
            className="ta-button-secondary h-10 px-4 text-sm"
            onClick={() => {
              setFieldErrors({});
              setStep((current) => current - 1);
            }}
          >
            Back
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="ta-button-primary h-10 px-4 text-sm"
            onClick={() => {
              const errors = validateStep();
              setFieldErrors(errors);
              if (Object.keys(errors).length > 0) return;
              setStep((current) => current + 1);
            }}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="ta-button-primary h-10 px-4 text-sm"
            disabled={busy}
            onClick={() => {
              const errors = validateStep();
              setFieldErrors(errors);
              if (Object.keys(errors).length > 0) return;
              setBusy(true);
              setFormError(null);
              void saveV2TeacherOnboarding({
                school_year_id: schoolYearId,
                grade_id: gradeId,
                student_count: Number(studentCount),
                selected_subject_ids: subjectIds,
              })
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
            {busy ? "Saving..." : "Save and continue"}
          </button>
        )}
      </div>
    </div>
  );
}
