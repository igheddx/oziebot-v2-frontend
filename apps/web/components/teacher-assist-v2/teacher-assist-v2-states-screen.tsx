"use client";

import { CatalogCrudTable } from "@/components/teacher-assist-v2/catalog-crud-table";
import {
  archiveV2State,
  createV2State,
  fetchV2States,
  updateV2State,
} from "@/lib/teacher-assist-v2-api";

export function TeacherAssistV2StatesScreen() {
  return (
    <CatalogCrudTable
      title="State Management"
      description="States anchor the academic hierarchy. Archive only after dependent districts and records are cleared."
      emptyLabel="No states yet."
      createLabel="Add state"
      loadRows={() => fetchV2States()}
      columns={[
        { key: "name", label: "Name" },
        { key: "abbreviation", label: "Abbreviation" },
      ]}
      fields={[
        { key: "name", label: "Name", placeholder: "Texas" },
        { key: "abbreviation", label: "Abbreviation", placeholder: "TX" },
      ]}
      onCreate={(form) =>
        createV2State({ name: form.name.trim(), abbreviation: form.abbreviation.trim().toUpperCase() })
      }
      onSave={(row, form) =>
        updateV2State(row.id, {
          name: form.name.trim(),
          abbreviation: form.abbreviation.trim().toUpperCase(),
          active: row.active,
        })
      }
      onArchive={(row) => archiveV2State(row.id)}
    />
  );
}
