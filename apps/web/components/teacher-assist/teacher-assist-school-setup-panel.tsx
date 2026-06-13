"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  TeacherAssistInlineAlert,
  sectionError,
  sectionSuccess,
  useTeacherAssistSectionAlerts,
} from "@/components/teacher-assist/teacher-assist-inline-alert";
import {
  fetchCatalogDistricts,
  fetchCatalogGrades,
  fetchCatalogSchools,
  fetchCatalogStates,
  fetchCatalogSubjects,
  fetchMySchoolSetup,
  saveMySchoolSetup,
} from "@/lib/education-catalog-api";
import type { EducationDistrict, EducationGrade, EducationSchool, EducationState, EducationSubject } from "@/lib/education-catalog-types";
import { withPreservedScroll } from "@/lib/teacher-assist-scroll";

type Props = {
  onSaved?: () => void | Promise<void>;
};

export function TeacherAssistSchoolSetupPanel({ onSaved }: Props) {
  const { setSectionAlert, clearSectionAlert, getSectionAlert } = useTeacherAssistSectionAlerts();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState<EducationState[]>([]);
  const [districts, setDistricts] = useState<EducationDistrict[]>([]);
  const [schools, setSchools] = useState<EducationSchool[]>([]);
  const [grades, setGrades] = useState<EducationGrade[]>([]);
  const [catalogSubjects, setCatalogSubjects] = useState<EducationSubject[]>([]);
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    clearSectionAlert("schoolSetup");
    try {
      const [stateRows, setup] = await Promise.all([fetchCatalogStates(), fetchMySchoolSetup()]);
      setStates(stateRows);
      if (setup.assignment) {
        setStateId(setup.assignment.state_id);
        setDistrictId(setup.assignment.district_id);
        setSchoolId(setup.assignment.school_id);
        setGradeId(setup.catalog_grade_id ?? "");
        setSelectedSubjectIds(setup.selected_catalog_subject_ids);
      }
    } catch (nextError) {
      setSectionAlert(
        "schoolSetup",
        sectionError(nextError instanceof Error ? nextError.message : "Could not load school setup.", "Load failed"),
      );
    } finally {
      setLoading(false);
    }
  }, [clearSectionAlert, setSectionAlert]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!stateId) {
      setDistricts([]);
      return;
    }
    void fetchCatalogDistricts(stateId).then(setDistricts).catch(() => setDistricts([]));
  }, [stateId]);

  useEffect(() => {
    if (!districtId) {
      setSchools([]);
      return;
    }
    void fetchCatalogSchools(districtId).then(setSchools).catch(() => setSchools([]));
  }, [districtId]);

  useEffect(() => {
    if (!schoolId) {
      setGrades([]);
      return;
    }
    void fetchCatalogGrades(schoolId).then(setGrades).catch(() => setGrades([]));
  }, [schoolId]);

  useEffect(() => {
    if (!gradeId) {
      setCatalogSubjects([]);
      return;
    }
    void fetchCatalogSubjects(gradeId).then(setCatalogSubjects).catch(() => setCatalogSubjects([]));
  }, [gradeId]);

  useEffect(() => {
    if (!gradeId || catalogSubjects.length === 0) {
      return;
    }
    setSelectedSubjectIds((current) => {
      const validIds = new Set(catalogSubjects.map((subject) => subject.id));
      const filtered = current.filter((id) => validIds.has(id));
      return filtered.length === current.length ? current : filtered;
    });
  }, [catalogSubjects, gradeId]);

  const selectedGrade = useMemo(() => grades.find((row) => row.id === gradeId) ?? null, [gradeId, grades]);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId],
    );
  };

  const saveSetup = async () => {
    if (!stateId || !districtId || !schoolId || !gradeId || selectedSubjectIds.length === 0) {
      setSectionAlert(
        "schoolSetup",
        sectionError("Select state, district, school, grade, and at least one district subject.", "Incomplete setup"),
      );
      return;
    }
    setSaving(true);
    clearSectionAlert("schoolSetup");
    try {
      await withPreservedScroll("school-setup-panel", async () => {
        const setup = await saveMySchoolSetup({
          state_id: stateId,
          district_id: districtId,
          school_id: schoolId,
          catalog_grade_id: gradeId,
          catalog_subject_ids: selectedSubjectIds,
        });
        setSelectedSubjectIds(setup.selected_catalog_subject_ids);
        await loadInitial();
        await onSaved?.();
      });
      setSectionAlert("schoolSetup", sectionSuccess("School placement and teaching subjects saved."));
    } catch (nextError) {
      setSectionAlert(
        "schoolSetup",
        sectionError(nextError instanceof Error ? nextError.message : "Could not save school setup.", "Save failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading school placement...</p>;
  }

  return (
    <div id="school-setup-panel" className="space-y-5">
      <TeacherAssistInlineAlert alert={getSectionAlert("schoolSetup")} onDismiss={() => clearSectionAlert("schoolSetup")} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">State</span>
          <select
            className="ta-input"
            value={stateId}
            onChange={(event) => {
              setStateId(event.target.value);
              setDistrictId("");
              setSchoolId("");
              setGradeId("");
              setSelectedSubjectIds([]);
            }}
          >
            <option value="">Select state</option>
            {states.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.abbreviation})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">District</span>
          <select
            className="ta-input"
            value={districtId}
            disabled={!stateId}
            onChange={(event) => {
              setDistrictId(event.target.value);
              setSchoolId("");
              setGradeId("");
              setSelectedSubjectIds([]);
            }}
          >
            <option value="">Select district</option>
            {districts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">School</span>
          <select
            className="ta-input"
            value={schoolId}
            disabled={!districtId}
            onChange={(event) => {
              setSchoolId(event.target.value);
              setGradeId("");
              setSelectedSubjectIds([]);
            }}
          >
            <option value="">Select school</option>
            {schools.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Grade</span>
          <select
            className="ta-input"
            value={gradeId}
            disabled={!schoolId}
            onChange={(event) => {
              setGradeId(event.target.value);
              setSelectedSubjectIds([]);
            }}
          >
            <option value="">Select grade</option>
            {grades.map((row) => (
              <option key={row.id} value={row.id}>
                {row.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Subjects you teach</h3>
            <p className="mt-1 text-sm text-slate-600">
              Choose from subjects offered for {selectedGrade?.display_name ?? "your selected grade"} in this district.
            </p>
          </div>
          <button type="button" className="ta-button-primary" disabled={saving} onClick={() => void saveSetup()}>
            {saving ? "Saving..." : "Save school setup"}
          </button>
        </div>

        {!gradeId ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            Select state, district, school, and grade to see district subjects.
          </div>
        ) : catalogSubjects.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
            No catalog subjects are published for this grade yet. Ask a root admin to add them in Catalog Admin.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {catalogSubjects.map((subject) => {
              const selected = selectedSubjectIds.includes(subject.id);
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => toggleSubject(subject.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    selected ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-sky-200"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{subject.display_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{subject.subject_code}</p>
                  <p className="mt-2 text-xs font-semibold text-sky-700">{selected ? "Selected" : "Tap to add"}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
