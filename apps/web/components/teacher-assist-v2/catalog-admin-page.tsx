"use client";

import { useEffect, useState } from "react";

type CatalogAdminPageProps<T extends { id: string; active: boolean }> = {
  title: string;
  description: string;
  loadRows: () => Promise<T[]>;
  renderLabel: (row: T) => string;
  renderMeta?: (row: T) => string;
  emptyLabel: string;
  createLabel: string;
  onCreate: (form: Record<string, string>) => Promise<unknown>;
  onSave: (row: T, form: Record<string, string>) => Promise<unknown>;
  onArchive: (row: T) => Promise<unknown>;
  fields: Array<{ key: string; label: string; placeholder?: string }>;
  filterSlot?: React.ReactNode;
};

export function CatalogAdminPage<T extends { id: string; active: boolean }>({
  title,
  description,
  loadRows,
  renderLabel,
  renderMeta,
  emptyLabel,
  createLabel,
  onCreate,
  onSave,
  onArchive,
  fields,
  filterSlot,
}: CatalogAdminPageProps<T>) {
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
            Object.fromEntries(fields.map((field) => [field.key, String((row as Record<string, unknown>)[field.key] ?? "")])),
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

  return (
    <div className="space-y-5">
      <header className="ta-panel p-5">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </header>

      {filterSlot}

      {error ? (
        <div className="ta-panel border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="ta-panel p-5">
        <h2 className="text-base font-semibold text-slate-900">{createLabel}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">{field.label}</span>
              <input
                className="ta-input"
                placeholder={field.placeholder}
                value={createForm[field.key] ?? ""}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="ta-button-primary mt-4"
          disabled={busyId === "create"}
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
          {busyId === "create" ? "Saving..." : createLabel}
        </button>
      </section>

      <section className="ta-panel p-5">
        <h2 className="text-base font-semibold text-slate-900">Existing records</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{renderLabel(row)}</p>
                    {renderMeta ? <p className="text-xs text-slate-500">{renderMeta(row)}</p> : null}
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        row.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {row.active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ta-button-primary text-xs"
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
                        className="ta-button-secondary text-xs"
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
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {fields.map((field) => (
                    <label key={field.key} className="block space-y-1 text-sm">
                      <span className="font-medium text-slate-700">{field.label}</span>
                      <input
                        className="ta-input"
                        value={editForms[row.id]?.[field.key] ?? ""}
                        onChange={(event) =>
                          setEditForms((current) => ({
                            ...current,
                            [row.id]: { ...current[row.id], [field.key]: event.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
