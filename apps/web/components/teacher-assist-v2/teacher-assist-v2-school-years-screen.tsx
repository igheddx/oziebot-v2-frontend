"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2SchoolYear,
  createV2SchoolYear,
  fetchV2Districts,
  fetchV2SchoolYears,
  fetchV2States,
  updateV2SchoolYear,
} from "@/lib/teacher-assist-v2-api";
import type { EducationDistrictRow, EducationSchoolYearRow, EducationStateRow } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2SchoolYearsScreen() {
  const [states, setStates] = useState<EducationStateRow[]>([]);
  const [districts, setDistricts] = useState<EducationDistrictRow[]>([]);

  useEffect(() => {
    void Promise.all([fetchV2States(true), fetchV2Districts(undefined, true)]).then(([nextStates, nextDistricts]) => {
      setStates(nextStates);
      setDistricts(nextDistricts);
    });
  }, []);

  const stateOptions = useMemo(() => states.map((s) => ({ value: s.id, label: s.name })), [states]);
  const districtOptions = useMemo(() => districts.map((d) => ({ value: d.id, label: d.name })), [districts]);

  return (
    <CatalogCrudTable<EducationSchoolYearRow>
      title="School Years"
      description="Platform school years anchor objectives and pacing guides. Only one school year may be active."
      emptyLabel="No school years yet."
      createLabel="Add school year"
      loadRows={() => fetchV2SchoolYears()}
      columns={[
        { key: "title", label: "Name" },
        { key: "start_date", label: "Start" },
        { key: "end_date", label: "End" },
        {
          key: "active",
          label: "Active",
          render: (row) => (row.active ? "Yes" : "No"),
        },
      ]}
      fields={[
        { key: "state_id", label: "State", type: "select", options: stateOptions, required: true },
        { key: "district_id", label: "District", type: "select", options: districtOptions, required: false },
        { key: "title", label: "School year name", placeholder: "2026-2027" },
        { key: "start_date", label: "Start date", placeholder: "2026-08-01" },
        { key: "end_date", label: "End date", placeholder: "2027-06-30" },
        {
          key: "active",
          label: "Active",
          type: "select",
          options: [
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ],
        },
      ]}
      getInitialForm={(row) => ({
        state_id: row.state_id,
        district_id: row.district_id ?? "",
        title: row.title,
        start_date: row.start_date,
        end_date: row.end_date,
        active: row.active ? "true" : "false",
      })}
      onCreate={(form) =>
        createV2SchoolYear({
          state_id: form.state_id,
          district_id: form.district_id || null,
          title: form.title.trim(),
          start_date: form.start_date,
          end_date: form.end_date,
          active: form.active === "true",
        })
      }
      onSave={(row, form) =>
        updateV2SchoolYear(row.id, {
          state_id: form.state_id,
          district_id: form.district_id || null,
          title: form.title.trim(),
          start_date: form.start_date,
          end_date: form.end_date,
          active: form.active === "true",
        })
      }
      onArchive={(row) => archiveV2SchoolYear(row.id)}
    />
  );
}
