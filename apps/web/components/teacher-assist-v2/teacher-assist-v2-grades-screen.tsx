"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2Grade,
  createV2Grade,
  fetchV2Grades,
  fetchV2Schools,
  updateV2Grade,
} from "@/lib/teacher-assist-v2-api";
import type { EducationGradeRow, EducationSchoolRow } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2GradesScreen() {
  const [schools, setSchools] = useState<EducationSchoolRow[]>([]);
  const [filterSchoolId, setFilterSchoolId] = useState("");

  const schoolOptions = useMemo(
    () => schools.map((school) => ({ value: school.id, label: school.name })),
    [schools],
  );

  useEffect(() => {
    void fetchV2Schools(undefined, true).then((next) => {
      setSchools(next);
      if (!filterSchoolId && next[0]) setFilterSchoolId(next[0].id);
    });
  }, [filterSchoolId]);

  const schoolName = (schoolId: string | null) =>
    schools.find((row) => row.id === schoolId)?.name ?? "—";

  return (
    <CatalogCrudTable<EducationGradeRow>
      key={filterSchoolId || "all"}
      title="Grade Management"
      description="Assign grades to schools. Elementary K–5, middle 6–8, high 9–12."
      emptyLabel="No grades assigned yet."
      createLabel="Assign grade"
      loadRows={() => fetchV2Grades(filterSchoolId || undefined)}
      filterSlot={
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="font-medium text-slate-700">Filter by school</span>
          <select className="ta-input h-9" value={filterSchoolId} onChange={(e) => setFilterSchoolId(e.target.value)}>
            <option value="">All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
      }
      columns={[
        { key: "school_id", label: "School", render: (row) => schoolName(row.school_id) },
        { key: "grade_code", label: "Code" },
        { key: "display_name", label: "Display name" },
      ]}
      fields={[
        { key: "school_id", label: "School", type: "select", options: schoolOptions, required: true },
        { key: "grade_code", label: "Grade code", placeholder: "K or 5" },
        { key: "display_name", label: "Display name", placeholder: "Grade 5" },
      ]}
      getInitialForm={(row) => ({
        school_id: row.school_id ?? "",
        grade_code: row.grade_code,
        display_name: row.display_name,
      })}
      onCreate={(form) =>
        createV2Grade({
          school_id: form.school_id,
          grade_code: form.grade_code.trim(),
          display_name: form.display_name.trim(),
        })
      }
      onSave={(row, form) =>
        updateV2Grade(row.id, {
          school_id: form.school_id,
          grade_code: form.grade_code.trim(),
          display_name: form.display_name.trim(),
          active: row.active,
        })
      }
      onArchive={(row) => archiveV2Grade(row.id)}
    />
  );
}
