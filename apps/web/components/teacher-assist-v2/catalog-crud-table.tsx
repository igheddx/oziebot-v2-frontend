"use client";

import { useEffect, useState } from "react";

export type CatalogFieldConfig = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select";
  options?: Array<{ value: string; label: string }>;
  /** Dynamic options that depend on other form values. Takes precedence over `options`. */
  getOptions?: (form: Record<string, string>) => Array<{ value: string; label: string }>;
  required?: boolean;
};

type CatalogCrudTableProps<T extends { id: string; active: boolean }> = {
  title: string;
  description: string;
  loadRows: () => Promise<T[]>;
  columns: Array<{ key: string; label: string; render?: (row: T) => string }>;
  emptyLabel: string;
  createLabel: string;
  fields: CatalogFieldConfig[];
  onCreate: (form: Record<string, string>) => Promise<unknown>;
  onSave: (row: T, form: Record<string, string>) => Promise<unknown>;
  onArchive: (row: T) => Promise<unknown>;
  filterSlot?: React.ReactNode;
  getInitialForm?: (row: T) => Record<string, string>;
};

function FieldInput({
  field,
  value,
  form,
  onChange,
}: {
  field: CatalogFieldConfig;
  value: string;
  form: Record<string, string>;
  onChange: (value: string) => void;
}) {
  if (field.type === "select") {
    const options = field.getOptions ? field.getOptions(form) : (field.options ?? []);
    return (
      <select className="ta-input h-9 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="ta-input h-9 text-sm"
      placeholder={field.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function CatalogCrudTable<T extends { id: string; active: boolean }>({
  title,
  description,
  loadRows,
  columns,
  emptyLabel,
  createLabel,
  fields,
  onCreate,
  onSave,
  onArchive,
  filterSlot,
  getInitialForm,
}: CatalogCrudTableProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, ""])),
  );
  const [editForms, setEditForms] = useState<Record<string, Record<string, string>>>({});

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadRows();
      setRows(next);
      setEditForms(
        Object.fromEntries(
          next.map((row) => [
            row.id,
            getInitialForm?.(row) ??
              Object.fromEntries(
                fields.map((field) => [field.key, String((row as Record<string, unknown>)[field.key] ?? "")]),
              ),
          ]),
        ),
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const canSubmit = (form: Record<string, string>) =>
    fields.filter((field) => field.required !== false).every((field) => (form[field.key] ?? "").trim().length > 0);

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>

      {filterSlot}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{createLabel}</h2>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            {fields.map((field) => (
              <label key={field.key} className="min-w-[140px] flex-1 space-y-1 text-xs">
                <span className="font-medium text-slate-600">{field.label}</span>
                <FieldInput
                  field={field}
                  value={createForm[field.key] ?? ""}
                  form={createForm}
                  onChange={(value) => setCreateForm((current) => ({ ...current, [field.key]: value }))}
                />
              </label>
            ))}
            <button
              type="button"
              className="ta-button-primary h-9 px-4 text-sm"
              disabled={busyId === "create" || !canSubmit(createForm)}
              onClick={() => {
                setBusyId("create");
                void onCreate(createForm)
                  .then(async () => {
                    setCreateForm(Object.fromEntries(fields.map((field) => [field.key, ""])));
                    await refresh();
                  })
                  .catch((nextError: Error) => setError(nextError.message))
                  .finally(() => setBusyId(null));
              }}
            >
              {busyId === "create" ? "Saving..." : "Add"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-2 font-semibold">
                    {column.label}
                  </th>
                ))}
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-6 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-6 text-slate-500">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-2">
                        {fields.some((field) => field.key === column.key) ? (
                          <FieldInput
                            field={fields.find((field) => field.key === column.key)!}
                            value={editForms[row.id]?.[column.key] ?? ""}
                            form={editForms[row.id] ?? {}}
                            onChange={(value) =>
                              setEditForms((current) => ({
                                ...current,
                                [row.id]: { ...current[row.id], [column.key]: value },
                              }))
                            }
                          />
                        ) : (
                          <span className="text-slate-800">
                            {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "")}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          row.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {row.active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="ta-button-primary h-8 px-2 text-xs"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setBusyId(row.id);
                            void onSave(row, editForms[row.id] ?? {})
                              .then(refresh)
                              .catch((nextError: Error) => setError(nextError.message))
                              .finally(() => setBusyId(null));
                          }}
                        >
                          Save
                        </button>
                        {row.active ? (
                          <button
                            type="button"
                            className="ta-button-secondary h-8 px-2 text-xs"
                            disabled={busyId === `${row.id}-archive`}
                            onClick={() => {
                              setBusyId(`${row.id}-archive`);
                              void onArchive(row)
                                .then(refresh)
                                .catch((nextError: Error) => setError(nextError.message))
                                .finally(() => setBusyId(null));
                            }}
                          >
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
