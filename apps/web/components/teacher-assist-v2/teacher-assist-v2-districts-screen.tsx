"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2District,
  createV2District,
  fetchV2Districts,
  fetchV2States,
  updateV2District,
} from "@/lib/teacher-assist-v2-api";
import type { EducationDistrictRow, EducationStateRow } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2DistrictsScreen() {
  const [states, setStates] = useState<EducationStateRow[]>([]);
  const [filterStateId, setFilterStateId] = useState("");

  const stateOptions = useMemo(
    () => states.map((state) => ({ value: state.id, label: state.name })),
    [states],
  );

  const loadStates = useCallback(async () => {
    const next = await fetchV2States(true);
    setStates(next);
    if (!filterStateId && next[0]) setFilterStateId(next[0].id);
  }, [filterStateId]);

  useEffect(() => {
    void loadStates();
  }, [loadStates]);

  const stateName = (stateId: string) => states.find((row) => row.id === stateId)?.name ?? "—";

  return (
    <CatalogCrudTable<EducationDistrictRow>
      key={filterStateId || "all"}
      title="District Management"
      description="Districts belong to a state. Each district needs a name and district code."
      emptyLabel="No districts found."
      createLabel="Add district"
      loadRows={() => fetchV2Districts(filterStateId || undefined)}
      filterSlot={
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="font-medium text-slate-700">Filter by state</span>
          <select className="ta-input h-9" value={filterStateId} onChange={(e) => setFilterStateId(e.target.value)}>
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </label>
      }
      columns={[
        {
          key: "state_id",
          label: "State",
          render: (row) => stateName(row.state_id),
        },
        { key: "name", label: "District name" },
        { key: "district_code", label: "Code" },
      ]}
      fields={[
        { key: "state_id", label: "State", type: "select", options: stateOptions, required: true },
        { key: "name", label: "District name", placeholder: "Leander Independent School District" },
        { key: "district_code", label: "District code", placeholder: "LISD", required: false },
      ]}
      getInitialForm={(row) => ({
        state_id: row.state_id,
        name: row.name,
        district_code: row.district_code ?? "",
      })}
      onCreate={(form) =>
        createV2District({
          state_id: form.state_id,
          name: form.name.trim(),
          district_code: form.district_code.trim() || null,
        })
      }
      onSave={(row, form) =>
        updateV2District(row.id, {
          state_id: form.state_id,
          name: form.name.trim(),
          district_code: form.district_code.trim() || null,
          active: row.active,
        })
      }
      onArchive={(row) => archiveV2District(row.id)}
    />
  );
}
