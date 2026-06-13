"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchV2Mastery } from "@/lib/teacher-assist-v2-api";
import type { MasteryEvidenceRow } from "@/lib/teacher-assist-v2-types";
import { MasteryLevelBadge } from "@/components/teacher-assist-v2/mastery-level-badge";

export function TeacherAssistV2MasteryScreen() {
  const [rows, setRows] = useState<MasteryEvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2Mastery()
      .then(setRows)
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-600">Loading mastery evidence...</p>;
  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>;
  }

  return (
    <div className="max-w-5xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Mastery</h1>
        <p className="mt-1 text-sm text-slate-600">Objective mastery evidence from teacher-confirmed grades.</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No mastery evidence yet. Confirm grades to create evidence.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Objective</th>
                <th className="px-3 py-2">Student #</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Assignment</th>
                <th className="px-3 py-2">Evidence date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.objective_label ?? row.education_objective_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{row.student_number}</td>
                  <td className="px-3 py-2">
                    <MasteryLevelBadge level={row.mastery_level} label={row.mastery_level_label} percentage={row.percentage} />
                  </td>
                  <td className="px-3 py-2">{row.score} ({row.percentage}%)</td>
                  <td className="px-3 py-2">
                    <Link href={`/teacher-assist-v2/assignments/view?id=${row.assignment_id}`} className="text-sky-700">
                      View assignment
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
