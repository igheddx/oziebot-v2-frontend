"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2School,
  createV2School,
  fetchV2Districts,
  fetchV2Schools,
  updateV2School,
} from "@/lib/teacher-assist-v2-api";
import type { EducationDistrictRow, EducationSchoolRow } from "@/lib/teacher-assist-v2-types";

const SCHOOL_TYPES = [
  { value: "Elementary", label: "Elementary" },
  { value: "Middle School", label: "Middle School" },
  { value: "High School", label: "High School" },
];

export function TeacherAssistV2SchoolsScreen() {
  const [districts, setDistricts] = useState<EducationDistrictRow[]>([]);
  const [filterDistrictId, setFilterDistrictId] = useState("");

  const districtOptions = useMemo(
    () => districts.map((district) => ({ value: district.id, label: district.name })),
    [districts],
  );

  useEffect(() => {
    void fetchV2Districts(undefined, true).then((next) => {
      setDistricts(next);
      if (!filterDistrictId && next[0]) setFilterDistrictId(next[0].id);
    });
  }, [filterDistrictId]);

  const districtName = (districtId: string) => districts.find((row) => row.id === districtId)?.name ?? "—";

  return (
    <CatalogCrudTable<EducationSchoolRow>
      key={filterDistrictId || "all"}
      title="School Management"
      description="Schools belong to districts and define which grade bands are offered."
      emptyLabel="No schools found."
      createLabel="Add school"
      loadRows={() => fetchV2Schools(filterDistrictId || undefined)}
      filterSlot={
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="font-medium text-slate-700">Filter by district</span>
          <select
            className="ta-input h-9"
            value={filterDistrictId}
            onChange={(e) => setFilterDistrictId(e.target.value)}
          >
            <option value="">All districts</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>
      }
      columns={[
        { key: "district_id", label: "District", render: (row) => districtName(row.district_id) },
        { key: "name", label: "School name" },
        { key: "school_type", label: "Type" },
      ]}
      fields={[
        { key: "district_id", label: "District", type: "select", options: districtOptions, required: true },
        { key: "name", label: "School name", placeholder: "Mason Elementary" },
        { key: "school_type", label: "School type", type: "select", options: SCHOOL_TYPES, required: true },
      ]}
      getInitialForm={(row) => ({
        district_id: row.district_id,
        name: row.name,
        school_type: row.school_type ?? "Elementary",
      })}
      onCreate={(form) =>
        createV2School({
          district_id: form.district_id,
          name: form.name.trim(),
          school_type: form.school_type,
        })
      }
      onSave={(row, form) =>
        updateV2School(row.id, {
          district_id: form.district_id,
          name: form.name.trim(),
          school_type: form.school_type,
          active: row.active,
        })
      }
      onArchive={(row) => archiveV2School(row.id)}
    />
  );
}
