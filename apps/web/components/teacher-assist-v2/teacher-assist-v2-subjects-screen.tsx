"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2Subject,
  createV2Subject,
  fetchV2Grades,
  fetchV2Subjects,
  updateV2Subject,
} from "@/lib/teacher-assist-v2-api";
import type { EducationGradeRow, EducationSubjectRow } from "@/lib/teacher-assist-v2-types";

const SUBJECT_PRESETS = [
  { code: "Math", name: "Math" },
  { code: "Science", name: "Science" },
  { code: "Social Studies", name: "Social Studies" },
  { code: "ELA", name: "ELA" },
];

export function TeacherAssistV2SubjectsScreen() {
  const [grades, setGrades] = useState<EducationGradeRow[]>([]);
  const [filterGradeId, setFilterGradeId] = useState("");

  const gradeOptions = useMemo(
    () =>
      grades.map((grade) => ({
        value: grade.id,
        label: `${grade.display_name} (${grade.grade_code})`,
      })),
    [grades],
  );

  useEffect(() => {
    void fetchV2Grades(undefined, true).then((next) => {
      setGrades(next);
      if (!filterGradeId && next[0]) setFilterGradeId(next[0].id);
    });
  }, [filterGradeId]);

  const gradeLabel = (gradeId: string | null) => {
    const grade = grades.find((row) => row.id === gradeId);
    return grade ? `${grade.display_name} (${grade.grade_code})` : "—";
  };

  return (
    <CatalogCrudTable<EducationSubjectRow>
      key={filterGradeId || "all"}
      title="Subject Management"
      description="Subjects belong to grades. Seed subjects include Math, Science, Social Studies, and ELA."
      emptyLabel="No subjects found."
      createLabel="Add subject"
      loadRows={() => fetchV2Subjects(filterGradeId || undefined)}
      filterSlot={
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[200px] space-y-1 text-sm">
            <span className="font-medium text-slate-700">Filter by grade</span>
            <select className="ta-input h-9" value={filterGradeId} onChange={(e) => setFilterGradeId(e.target.value)}>
              <option value="">All grades</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.display_name} ({grade.grade_code})
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1">
            {SUBJECT_PRESETS.map((preset) => (
              <span
                key={preset.code}
                className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
              >
                {preset.name}
              </span>
            ))}
          </div>
        </div>
      }
      columns={[
        { key: "grade_id", label: "Grade", render: (row) => gradeLabel(row.grade_id) },
        { key: "subject_code", label: "Code" },
        { key: "display_name", label: "Display name" },
      ]}
      fields={[
        { key: "grade_id", label: "Grade", type: "select", options: gradeOptions, required: true },
        { key: "subject_code", label: "Subject code", placeholder: "Math" },
        { key: "display_name", label: "Display name", placeholder: "Math" },
      ]}
      getInitialForm={(row) => ({
        grade_id: row.grade_id ?? "",
        subject_code: row.subject_code,
        display_name: row.display_name,
      })}
      onCreate={(form) =>
        createV2Subject({
          grade_id: form.grade_id,
          subject_code: form.subject_code.trim(),
          display_name: form.display_name.trim(),
        })
      }
      onSave={(row, form) =>
        updateV2Subject(row.id, {
          grade_id: form.grade_id,
          subject_code: form.subject_code.trim(),
          display_name: form.display_name.trim(),
          active: row.active,
        })
      }
      onArchive={(row) => archiveV2Subject(row.id)}
    />
  );
}
