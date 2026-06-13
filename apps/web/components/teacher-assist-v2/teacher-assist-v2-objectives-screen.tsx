"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2Objective,
  createV2Objective,
  fetchV2Grades,
  fetchV2Objectives,
  fetchV2SchoolYears,
  fetchV2States,
  fetchV2Subjects,
  updateV2Objective,
} from "@/lib/teacher-assist-v2-api";
import type {
  EducationGradeRow,
  EducationObjectiveRow,
  EducationSchoolYearRow,
  EducationStateRow,
  EducationSubjectRow,
} from "@/lib/teacher-assist-v2-types";

const OBJECTIVE_TYPES = [
  { value: "TEKS", label: "TEKS" },
  { value: "StateStandard", label: "State Standard" },
  { value: "DistrictStandard", label: "District Standard" },
  { value: "CustomStandard", label: "Custom Standard" },
];

export function TeacherAssistV2ObjectivesScreen() {
  const [states, setStates] = useState<EducationStateRow[]>([]);
  const [grades, setGrades] = useState<EducationGradeRow[]>([]);
  const [subjects, setSubjects] = useState<EducationSubjectRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<EducationSchoolYearRow[]>([]);
  const [filterSchoolYearId, setFilterSchoolYearId] = useState("");

  useEffect(() => {
    void Promise.all([
      fetchV2States(true),
      fetchV2Grades(undefined, true),
      fetchV2Subjects(undefined, true),
      fetchV2SchoolYears(),
    ]).then(([nextStates, nextGrades, nextSubjects, nextYears]) => {
      setStates(nextStates);
      setGrades(nextGrades);
      setSubjects(nextSubjects);
      setSchoolYears(nextYears);
      const active = nextYears.find((row) => row.active) ?? nextYears[0];
      if (active) setFilterSchoolYearId(active.id);
    });
  }, []);

  const gradeOptions = useMemo(
    () => grades.map((g) => ({ value: g.id, label: `${g.display_name} (${g.grade_code})` })),
    [grades],
  );
  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: `${s.display_name} (${s.subject_code})` })),
    [subjects],
  );
  const schoolYearOptions = useMemo(
    () => schoolYears.map((y) => ({ value: y.id, label: y.title })),
    [schoolYears],
  );

  const subjectCode = (subjectId: string) =>
    subjects.find((row) => row.id === subjectId)?.subject_code ?? "—";

  return (
    <CatalogCrudTable<EducationObjectiveRow>
      key={filterSchoolYearId || "all"}
      title="Learning Objectives"
      description="Objectives inherit grade, subject, and school year. Teachers consume these — they do not create them."
      emptyLabel="No objectives for this filter."
      createLabel="Add objective"
      loadRows={() => fetchV2Objectives({ school_year_id: filterSchoolYearId || undefined })}
      filterSlot={
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="font-medium text-slate-700">School year</span>
          <select
            className="ta-input h-9"
            value={filterSchoolYearId}
            onChange={(e) => setFilterSchoolYearId(e.target.value)}
          >
            <option value="">All school years</option>
            {schoolYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.title}
              </option>
            ))}
          </select>
        </label>
      }
      columns={[
        { key: "objective_id", label: "Objective ID" },
        { key: "objective_type", label: "Type" },
        { key: "subject_id", label: "Subject", render: (row) => subjectCode(row.subject_id ?? "") },
        { key: "description", label: "Description" },
        {
          key: "coverage_type",
          label: "Required",
          render: (row) => (row.coverage_type === "required" ? "Yes" : "No"),
        },
      ]}
      fields={[
        { key: "state_id", label: "State", type: "select", options: states.map((s) => ({ value: s.id, label: s.name })), required: true },
        { key: "grade_id", label: "Grade", type: "select", options: gradeOptions, required: true },
        { key: "subject_id", label: "Subject", type: "select", options: subjectOptions, required: true },
        { key: "school_year_id", label: "School year", type: "select", options: schoolYearOptions, required: true },
        { key: "objective_type", label: "Type", type: "select", options: OBJECTIVE_TYPES, required: true },
        { key: "objective_id", label: "Objective ID", placeholder: "5.MATH.1" },
        { key: "description", label: "Description", placeholder: "Students will..." },
        {
          key: "is_required",
          label: "Required",
          type: "select",
          options: [
            { value: "true", label: "Required" },
            { value: "false", label: "Optional" },
          ],
        },
      ]}
      getInitialForm={(row) => ({
        state_id: row.state_id,
        grade_id: row.grade_id ?? "",
        subject_id: row.subject_id ?? "",
        school_year_id: row.school_year_id ?? "",
        objective_type: row.objective_type,
        objective_id: row.objective_id,
        description: row.description,
        is_required: row.coverage_type === "required" ? "true" : "false",
      })}
      onCreate={(form) =>
        createV2Objective({
          state_id: form.state_id,
          grade_id: form.grade_id,
          subject_id: form.subject_id,
          school_year_id: form.school_year_id,
          objective_type: form.objective_type,
          objective_id: form.objective_id.trim(),
          description: form.description.trim(),
          is_required: form.is_required === "true",
        })
      }
      onSave={(row, form) =>
        updateV2Objective(row.id, {
          state_id: form.state_id,
          grade_id: form.grade_id,
          subject_id: form.subject_id,
          school_year_id: form.school_year_id,
          objective_type: form.objective_type,
          objective_id: form.objective_id.trim(),
          description: form.description.trim(),
          is_required: form.is_required === "true",
          active: row.active,
        })
      }
      onArchive={(row) => archiveV2Objective(row.id)}
    />
  );
}
