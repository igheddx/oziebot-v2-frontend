"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PacingGuideSupportingMaterialsPanel } from "@/components/teacher-assist-v2/pacing-guide-supporting-materials-panel";
import {
  createV2PacingGuideBuilder,
  fetchV2Districts,
  fetchV2Grades,
  fetchV2Objectives,
  fetchV2PacingGuide,
  fetchV2SchoolYears,
  fetchV2Schools,
  fetchV2States,
  fetchV2Subjects,
  updateV2PacingGuideBuilder,
} from "@/lib/teacher-assist-v2-api";
import type {
  EducationDistrictRow,
  EducationGradeRow,
  EducationObjectiveRow,
  EducationSchoolRow,
  EducationSchoolYearRow,
  EducationStateRow,
  EducationSubjectRow,
  PacingGuideBuilderPayload,
  PacingGuideDailyPlan,
  PacingGuideDetail,
} from "@/lib/teacher-assist-v2-types";

const STEPS = ["Scope", "Objectives", "Weekly/Daily Plan", "Resources & Links", "Review & Save"] as const;
const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function emptyDailyPlans(): PacingGuideDailyPlan[] {
  return DEFAULT_DAYS.map((day_label) => ({ day_label, daily_topic: "" }));
}

function defaultWeek(sequence: number) {
  return {
    title: `Week ${sequence}`,
    description: "",
    sequence_number: sequence,
    unit_title: "",
    daily_plans: emptyDailyPlans(),
  };
}

export function TeacherAssistV2PacingGuideBuilderScreen() {
  const searchParams = useSearchParams();
  const editGuideId = searchParams.get("id");

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedGuideId, setSavedGuideId] = useState<string | null>(editGuideId);

  const [states, setStates] = useState<EducationStateRow[]>([]);
  const [districts, setDistricts] = useState<EducationDistrictRow[]>([]);
  const [schools, setSchools] = useState<EducationSchoolRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<EducationSchoolYearRow[]>([]);
  const [grades, setGrades] = useState<EducationGradeRow[]>([]);
  const [subjects, setSubjects] = useState<EducationSubjectRow[]>([]);
  const [objectives, setObjectives] = useState<EducationObjectiveRow[]>([]);

  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [ownershipScope, setOwnershipScope] = useState<"district" | "school">("district");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  const [estimatedWeeks, setEstimatedWeeks] = useState("1");
  const [startWeek, setStartWeek] = useState("1");
  const [endWeek, setEndWeek] = useState("1");
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>([]);
  const [weeks, setWeeks] = useState([defaultWeek(1)]);
  const [savedPeriods, setSavedPeriods] = useState<
    Array<{ id: string; title: string; sequence_number: number; days: Array<{ id: string; day_label: string }> }>
  >([]);

  const syncSavedPeriodsFromGuide = (guide: PacingGuideDetail) => {
    setSavedPeriods(
      guide.periods.map((period) => ({
        id: period.id,
        title: period.title,
        sequence_number: period.sequence_number,
        days: (period.daily_plans ?? [])
          .filter((day) => day.id)
          .map((day) => ({ id: day.id as string, day_label: day.day_label })),
      })),
    );
  };

  const resolveSavedDayId = (weekIndex: number, dayLabel: string): string | null => {
    const period = savedPeriods[weekIndex];
    if (!period) return null;
    return period.days.find((day) => day.day_label === dayLabel)?.id ?? null;
  };

  const updateDayField = (
    weekIndex: number,
    dayIndex: number,
    field: keyof PacingGuideDailyPlan,
    value: string,
  ) => {
    setWeeks((current) =>
      current.map((item, index) =>
        index === weekIndex
          ? {
              ...item,
              daily_plans: item.daily_plans.map((plan, planIndex) =>
                planIndex === dayIndex ? { ...plan, [field]: value } : plan,
              ),
            }
          : item,
      ),
    );
  };

  const applyGuideToForm = (guide: PacingGuideDetail) => {
    setSavedGuideId(guide.id);
    setStateId(guide.catalog_state_id ?? "");
    setDistrictId(guide.catalog_district_id ?? "");
    setSchoolId(guide.catalog_school_id ?? "");
    setGradeId(guide.catalog_grade_id ?? "");
    setSubjectId(guide.catalog_subject_id ?? "");
    setTitle(guide.title);
    setDescription(guide.description ?? "");
    setOwnershipScope(guide.ownership_scope ?? (guide.catalog_school_id ? "school" : "district"));
    if (guide.platform_school_year_id) {
      setSchoolYearId(guide.platform_school_year_id);
    }
    if (guide.unit_title) setUnitTitle(guide.unit_title);
    if (guide.estimated_duration_weeks != null) setEstimatedWeeks(String(guide.estimated_duration_weeks));
    if (guide.start_week != null) setStartWeek(String(guide.start_week));
    if (guide.end_week != null) setEndWeek(String(guide.end_week));
    setWeeks(
      guide.periods.length
        ? guide.periods.map((period) => ({
            title: period.title,
            description: period.description ?? "",
            sequence_number: period.sequence_number,
            unit_title: period.unit_title ?? "",
            daily_plans:
              period.daily_plans && period.daily_plans.length > 0 ? period.daily_plans : emptyDailyPlans(),
          }))
        : [defaultWeek(1)],
    );
    syncSavedPeriodsFromGuide(guide);
    const objectiveIds = new Set<string>();
    guide.periods.forEach((period) => {
      period.objectives.forEach((row) => objectiveIds.add(row.objective_id));
    });
    setSelectedObjectiveIds([...objectiveIds]);
    if (!guide.platform_school_year_id && guide.school_year_label && guide.catalog_state_id) {
      void fetchV2SchoolYears(guide.catalog_state_id, true).then((years) => {
        const match = years.find((row) => row.title === guide.school_year_label);
        if (match) setSchoolYearId(match.id);
      });
    }
  };

  useEffect(() => {
    void fetchV2States(true).then(setStates);
  }, []);

  useEffect(() => {
    if (!stateId) return;
    void fetchV2Districts(stateId, true).then(setDistricts);
  }, [stateId]);

  useEffect(() => {
    if (!districtId) return;
    void fetchV2Schools(districtId, true).then(setSchools);
    void fetchV2SchoolYears(stateId, true).then(setSchoolYears);
  }, [districtId, stateId]);

  useEffect(() => {
    if (!gradeId) return;
    void fetchV2Subjects(gradeId, true).then(setSubjects);
  }, [gradeId]);

  useEffect(() => {
    if (!gradeId || !subjectId) return;
    void fetchV2Objectives({ grade_id: gradeId, subject_id: subjectId, active_only: true }).then(setObjectives);
  }, [gradeId, subjectId]);

  useEffect(() => {
    if (!districtId) return;
    void fetchV2Grades(undefined, true).then((rows) => {
      setGrades(rows.filter((row) => !row.school_id || row.school_id === schoolId || !schoolId));
    });
  }, [districtId, schoolId]);

  useEffect(() => {
    if (!editGuideId) return;
    void fetchV2PacingGuide(editGuideId)
      .then((guide) => applyGuideToForm(guide))
      .catch((nextError: Error) => setError(nextError.message));
  }, [editGuideId]);

  const payload = useMemo((): PacingGuideBuilderPayload | null => {
    if (!stateId || !districtId || !schoolYearId || !gradeId || !subjectId || !title.trim()) return null;
    if (ownershipScope === "school" && !schoolId) return null;
    if (selectedObjectiveIds.length === 0) return null;
    return {
      catalog_state_id: stateId,
      catalog_district_id: districtId,
      catalog_school_id: ownershipScope === "school" ? schoolId : null,
      platform_school_year_id: schoolYearId,
      catalog_grade_id: gradeId,
      catalog_subject_id: subjectId,
      ownership_scope: ownershipScope,
      title: title.trim(),
      description: description.trim() || null,
      unit_title: unitTitle.trim() || null,
      estimated_duration_weeks: Number.parseInt(estimatedWeeks, 10) || 1,
      start_week: Number.parseInt(startWeek, 10) || 1,
      end_week: Number.parseInt(endWeek, 10) || 1,
      objectives: selectedObjectiveIds.map((objective_id) => ({ objective_id, is_required: true })),
      weeks: weeks.map((week, index) => ({
        title: week.title,
        description: week.description || null,
        sequence_number: week.sequence_number ?? index + 1,
        unit_title: week.unit_title || unitTitle || null,
        daily_plans: week.daily_plans.filter((day) => day.day_label.trim()),
        objective_ids: selectedObjectiveIds,
      })),
    };
  }, [
    stateId,
    districtId,
    schoolId,
    schoolYearId,
    gradeId,
    subjectId,
    ownershipScope,
    title,
    description,
    unitTitle,
    estimatedWeeks,
    startWeek,
    endWeek,
    selectedObjectiveIds,
    weeks,
  ]);

  const saveStructure = async (): Promise<string | null> => {
    if (!payload) {
      setError("Complete scope, objectives, and weekly plan before saving.");
      return null;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = savedGuideId
        ? await updateV2PacingGuideBuilder(savedGuideId, payload)
        : await createV2PacingGuideBuilder(payload);
      setSavedGuideId(result.id);
      setSavedPeriods(
        result.periods.map((period) => ({
          id: period.id,
          title: period.title,
          sequence_number: period.sequence_number,
          days: (period.daily_plans ?? [])
            .filter((day) => day.id)
            .map((day) => ({ id: day.id as string, day_label: day.day_label })),
        })),
      );
      setMessage("Pacing guide structure saved.");
      return result.id;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save pacing guide.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/admin/pacing-guides" className="text-xs font-semibold text-sky-700">
          ← Pacing guides
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          {editGuideId ? "Edit pacing guide" : "Create pacing guide"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Build a district or school pacing guide linked to catalog scope, objectives, weekly plans, and resources.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              step === index
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {step === 0 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Scope</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">State</span>
              <select className="ta-input mt-1 w-full" value={stateId} onChange={(e) => setStateId(e.target.value)}>
                <option value="">Select state</option>
                {states.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">District</span>
              <select className="ta-input mt-1 w-full" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
                <option value="">Select district</option>
                {districts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">School (optional unless school scope)</span>
              <select className="ta-input mt-1 w-full" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">No school</option>
                {schools.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">School year</span>
              <select className="ta-input mt-1 w-full" value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
                <option value="">Select school year</option>
                {schoolYears.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Grade</span>
              <select className="ta-input mt-1 w-full" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                <option value="">Select grade</option>
                {grades.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Subject</span>
              <select className="ta-input mt-1 w-full" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Ownership scope</span>
              <select
                className="ta-input mt-1 w-full"
                value={ownershipScope}
                onChange={(e) => setOwnershipScope(e.target.value as "district" | "school")}
              >
                <option value="district">District</option>
                <option value="school">School</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Pacing guide title</span>
              <input className="ta-input mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Description</span>
              <textarea className="ta-input mt-1 w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Unit title</span>
              <input className="ta-input mt-1 w-full" value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Estimated duration (weeks)</span>
              <input className="ta-input mt-1 w-full" type="number" min={1} value={estimatedWeeks} onChange={(e) => setEstimatedWeeks(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Start week</span>
              <input className="ta-input mt-1 w-full" type="number" min={1} value={startWeek} onChange={(e) => setStartWeek(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">End week</span>
              <input className="ta-input mt-1 w-full" type="number" min={1} value={endWeek} onChange={(e) => setEndWeek(e.target.value)} />
            </label>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Learning objectives</h2>
          <p className="text-sm text-slate-600">Select objectives from the academic catalog. Freeform objectives are not allowed.</p>
          {!gradeId || !subjectId ? (
            <p className="text-sm text-slate-500">Choose grade and subject in Scope first.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {objectives.map((objective) => (
                <li key={objective.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedObjectiveIds.includes(objective.id)}
                      onChange={(event) => {
                        setSelectedObjectiveIds((current) =>
                          event.target.checked
                            ? [...current, objective.id]
                            : current.filter((id) => id !== objective.id),
                        );
                      }}
                    />
                    <span>
                      <span className="font-medium text-slate-900">{objective.objective_id}</span>
                      <span className="mt-1 block text-slate-600">{objective.description}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="ta-panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Weekly / daily plan</h2>
            <button
              type="button"
              className="ta-button-secondary h-8 px-3 text-xs"
              onClick={() => setWeeks((current) => [...current, defaultWeek(current.length + 1)])}
            >
              Add week
            </button>
          </div>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">Week title</span>
                  <input
                    className="ta-input mt-1 w-full"
                    value={week.title}
                    onChange={(event) =>
                      setWeeks((current) =>
                        current.map((item, index) => (index === weekIndex ? { ...item, title: event.target.value } : item)),
                      )
                    }
                  />
                </label>
              </div>
              <div className="mt-4 space-y-2">
                {week.daily_plans.map((day, dayIndex) => {
                  const savedPeriod = savedPeriods[weekIndex];
                  const dayId = day.id ?? resolveSavedDayId(weekIndex, day.day_label);
                  const topicMissing = !(day.daily_topic ?? "").trim();
                  return (
                    <details key={`${weekIndex}-${day.day_label}`} className="rounded-lg border border-slate-200 bg-white">
                      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-900">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-slate-500">{day.day_label}</span>
                          <span>{day.daily_topic?.trim() || "Add daily topic"}</span>
                          {topicMissing ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Topic required
                            </span>
                          ) : null}
                        </span>
                      </summary>
                      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                        <label className="block text-sm">
                          <span className="font-medium text-slate-700">Daily topic</span>
                          <input
                            className={`ta-input mt-1 w-full ${topicMissing ? "border-amber-400" : ""}`}
                            value={day.daily_topic ?? ""}
                            onChange={(event) => updateDayField(weekIndex, dayIndex, "daily_topic", event.target.value)}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium text-slate-700">Learning objective focus</span>
                          <input
                            className="ta-input mt-1 w-full"
                            value={day.objective_focus ?? ""}
                            onChange={(event) => updateDayField(weekIndex, dayIndex, "objective_focus", event.target.value)}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium text-slate-700">Materials needed</span>
                          <textarea
                            className="ta-input mt-1 w-full"
                            rows={2}
                            value={day.materials_needed ?? ""}
                            onChange={(event) => updateDayField(weekIndex, dayIndex, "materials_needed", event.target.value)}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium text-slate-700">Assessment / check for understanding</span>
                          <textarea
                            className="ta-input mt-1 w-full"
                            rows={2}
                            value={day.assessment_check ?? ""}
                            onChange={(event) => updateDayField(weekIndex, dayIndex, "assessment_check", event.target.value)}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium text-slate-700">Teacher notes</span>
                          <textarea
                            className="ta-input mt-1 w-full"
                            rows={2}
                            value={day.teacher_notes ?? ""}
                            onChange={(event) => updateDayField(weekIndex, dayIndex, "teacher_notes", event.target.value)}
                          />
                        </label>
                        {savedGuideId && dayId && savedPeriod ? (
                          <PacingGuideSupportingMaterialsPanel
                            pacingGuideId={savedGuideId}
                            periodId={savedPeriod.id}
                            periodDayId={dayId}
                            compact
                            scopeLabel={`${day.day_label} resources`}
                          />
                        ) : (
                          <p className="text-xs text-slate-500">
                            Save the guide structure to attach day-specific files and links.
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Resources & links</h2>
          {!savedGuideId ? (
            <p className="text-sm text-slate-600">
              Save the guide structure first so uploads and links stay connected to this pacing guide.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ta-button-primary"
              disabled={saving}
              onClick={() => void saveStructure().then((id) => id && setStep(3))}
            >
              {saving ? "Saving…" : savedGuideId ? "Update structure" : "Save structure & attach resources"}
            </button>
          </div>
          {savedGuideId ? (
            <>
              <PacingGuideSupportingMaterialsPanel
                pacingGuideId={savedGuideId}
                guideLevelOnly
                scopeLabel="Guide level"
              />
              {savedPeriods.map((period) => (
                <PacingGuideSupportingMaterialsPanel
                  key={period.id}
                  pacingGuideId={savedGuideId}
                  periodId={period.id}
                  weekLevelOnly
                  scopeLabel={`Week ${period.sequence_number}: ${period.title}`}
                />
              ))}
            </>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Review & save</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Title</dt>
              <dd className="font-medium text-slate-900">{title || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Scope</dt>
              <dd className="font-medium text-slate-900">{ownershipScope === "school" ? "School" : "District"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Objectives</dt>
              <dd className="font-medium text-slate-900">{selectedObjectiveIds.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Weeks</dt>
              <dd className="font-medium text-slate-900">{weeks.length}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ta-button-primary" disabled={saving} onClick={() => void saveStructure()}>
              {saving ? "Saving…" : "Save pacing guide"}
            </button>
            {savedGuideId ? (
              <Link href={`/teacher-assist-v2/admin/pacing-guides/view/?id=${encodeURIComponent(savedGuideId)}`} className="ta-button-secondary inline-flex h-9 items-center px-3 text-sm">
                Open guide
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="ta-button-secondary"
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          Back
        </button>
        <button
          type="button"
          className="ta-button-secondary"
          disabled={step >= STEPS.length - 1}
          onClick={async () => {
            if (step === 2 && !savedGuideId) {
              const id = await saveStructure();
              if (!id) return;
            }
            setStep((current) => Math.min(STEPS.length - 1, current + 1));
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
