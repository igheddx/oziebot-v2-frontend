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
  PacingGuideDetail,
} from "@/lib/teacher-assist-v2-types";

const STEPS = ["Scope", "Objectives", "Duration", "Supporting Documents", "Review & Save"] as const;

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
  const [estimatedWeeks, setEstimatedWeeks] = useState("6");
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>([]);

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
      estimated_duration_weeks: Number.parseInt(estimatedWeeks, 10) || 6,
      objectives: selectedObjectiveIds.map((objective_id) => ({ objective_id, is_required: true })),
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
    selectedObjectiveIds,
  ]);

  const saveStructure = async (): Promise<string | null> => {
    if (!payload) {
      setError("Complete scope, objectives, and duration before saving.");
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
      setMessage("Pacing guide saved.");
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
          Define scope, TEKS objectives, duration, and supporting curriculum documents. AI generates the daily
          lesson plans for teachers based on this guide.
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

      {/* Step 0 — Scope */}
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
          </div>
        </section>
      ) : null}

      {/* Step 1 — Objectives */}
      {step === 1 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Learning objectives (TEKS)</h2>
          <p className="text-sm text-slate-600">
            Select one or more TEKS from the academic catalog. AI will align all generated lesson plans and
            assignments to these objectives.
          </p>
          {!gradeId || !subjectId ? (
            <p className="text-sm text-slate-500">Choose grade and subject in Scope first.</p>
          ) : objectives.length === 0 ? (
            <p className="text-sm text-slate-500">No objectives found for this grade and subject.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{selectedObjectiveIds.length} selected</p>
                <button
                  type="button"
                  className="text-xs text-sky-700 underline"
                  onClick={() =>
                    setSelectedObjectiveIds(
                      selectedObjectiveIds.length === objectives.length ? [] : objectives.map((o) => o.id),
                    )
                  }
                >
                  {selectedObjectiveIds.length === objectives.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
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
            </>
          )}
        </section>
      ) : null}

      {/* Step 2 — Duration */}
      {step === 2 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Duration</h2>
          <p className="text-sm text-slate-600">
            Specify how many weeks teachers will spend on this set of objectives. AI uses this duration to
            structure a full daily teaching plan — it determines what to teach each week and each day based on
            the selected TEKS and supporting documents.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Duration (weeks)</span>
              <input
                className="ta-input mt-1 w-full"
                type="number"
                min={1}
                max={36}
                value={estimatedWeeks}
                onChange={(e) => setEstimatedWeeks(e.target.value)}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Typical range: 2–8 weeks per objective set.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Unit title (optional)</span>
              <input
                className="ta-input mt-1 w-full"
                placeholder="e.g. Informational Reading Unit 2"
                value={unitTitle}
                onChange={(e) => setUnitTitle(e.target.value)}
              />
            </label>
          </div>
        </section>
      ) : null}

      {/* Step 3 — Supporting Documents */}
      {step === 3 ? (
        <section className="ta-panel space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Supporting documents</h2>
          <p className="text-sm text-slate-600">
            Upload curriculum documents, pacing calendars, book lists, assignment guides, or any instructional
            reference material. AI extracts and uses this content when generating lesson plans — the more context
            you provide, the more specific and aligned the generated plans will be.
          </p>
          {!savedGuideId ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-800">Save the guide structure first to attach documents.</p>
              <button
                type="button"
                className="ta-button-primary"
                disabled={saving}
                onClick={() => void saveStructure()}
              >
                {saving ? "Saving…" : "Save & continue to documents"}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="ta-button-secondary h-8 px-3 text-xs"
                disabled={saving}
                onClick={() => void saveStructure()}
              >
                {saving ? "Saving…" : "Update guide"}
              </button>
              <PacingGuideSupportingMaterialsPanel
                pacingGuideId={savedGuideId}
                guideLevelOnly
                scopeLabel="Curriculum documents & references"
              />
            </>
          )}
        </section>
      ) : null}

      {/* Step 4 — Review & Save */}
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
              <dt className="text-slate-500">Unit title</dt>
              <dd className="font-medium text-slate-900">{unitTitle || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-medium text-slate-900">{estimatedWeeks} week{Number(estimatedWeeks) !== 1 ? "s" : ""}</dd>
            </div>
            <div>
              <dt className="text-slate-500">TEKS objectives</dt>
              <dd className="font-medium text-slate-900">{selectedObjectiveIds.length} selected</dd>
            </div>
          </dl>
          <p className="text-sm text-slate-600">
            When a teacher generates a lesson plan using this guide, AI will produce a complete daily teaching
            plan for the full duration — using the selected TEKS and all attached supporting documents.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ta-button-primary" disabled={saving} onClick={() => void saveStructure()}>
              {saving ? "Saving…" : "Save pacing guide"}
            </button>
            {savedGuideId ? (
              <Link
                href={`/teacher-assist-v2/admin/pacing-guides/view/?id=${encodeURIComponent(savedGuideId)}`}
                className="ta-button-secondary inline-flex h-9 items-center px-3 text-sm"
              >
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
