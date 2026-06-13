"use client";

import { useEffect, useState } from "react";

import { fetchV2Hierarchy } from "@/lib/teacher-assist-v2-api";
import type { HierarchyStateNode } from "@/lib/teacher-assist-v2-types";

function TreeLine({ depth, label }: { depth: number; label: string }) {
  const prefix = depth === 0 ? "" : `${"│   ".repeat(Math.max(depth - 1, 0))}${depth > 0 ? "├── " : ""}`;
  return (
    <div className="font-mono text-sm leading-6 text-slate-800">
      <span className="text-slate-400">{prefix}</span>
      {label}
    </div>
  );
}

export function TeacherAssistV2HierarchyScreen() {
  const [tree, setTree] = useState<HierarchyStateNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2Hierarchy(true)
      .then(setTree)
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Hierarchy Explorer</h1>
        <p className="mt-1 text-sm text-slate-600">
          Verify state → district → school → grade → subject relationships at a glance.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        {loading ? (
          <p className="text-sm text-slate-600">Loading hierarchy...</p>
        ) : tree.length === 0 ? (
          <p className="text-sm text-slate-500">No active hierarchy records yet. Run the seed or add states first.</p>
        ) : (
          <div className="space-y-1">
            {tree.map((state) => (
              <div key={state.id}>
                <TreeLine depth={0} label={`${state.name} (${state.abbreviation})`} />
                {state.districts.map((district) => (
                  <div key={district.id}>
                    <TreeLine
                      depth={1}
                      label={`${district.name}${district.district_code ? ` [${district.district_code}]` : ""}`}
                    />
                    {district.schools.map((school) => (
                      <div key={school.id}>
                        <TreeLine depth={2} label={`${school.name} (${school.school_type ?? "School"})`} />
                        {school.grades.map((grade) => (
                          <div key={grade.id}>
                            <TreeLine depth={3} label={grade.display_name} />
                            {grade.subjects.map((subject) => (
                              <TreeLine key={subject.id} depth={4} label={subject.display_name} />
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
