"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchV2Assignments } from "@/lib/teacher-assist-v2-api";
import type { AssignmentSummary } from "@/lib/teacher-assist-v2-types";

const STATUS_STYLES: Record<string, string> = {
  GENERATED: "bg-sky-50 text-sky-800 border-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DRAFT: "bg-slate-50 text-slate-700 border-slate-200",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
};

export function TeacherAssistV2AssignmentsScreen() {
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2Assignments({ status: status || undefined })
      .then(setAssignments)
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="max-w-4xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/home" className="text-xs font-semibold text-sky-700">
          ← Back to home
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Assignments</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/teacher-assist-v2/assignments/create" className="ta-button-primary inline-flex h-9 items-center px-4 text-sm">
            Create assignment
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Generated package assignments and teacher-created assignments with QR cover sheets for scanning.
        </p>
      </header>

      <label className="block max-w-xs space-y-1 text-sm">
        <span className="font-medium text-slate-700">Filter by status</span>
        <select className="ta-input h-9" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="GENERATED">Generated</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </label>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {loading ? <p className="text-sm text-slate-600">Loading assignments...</p> : null}

      {!loading && assignments.length === 0 ? (
        <p className="text-sm text-slate-600">No assignments yet. Generate a package with quiz or written assignment outputs.</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/90">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Week</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(assignment.id)}`}
                    className="font-medium text-sky-700"
                  >
                    {assignment.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{assignment.assignment_type.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">Week {assignment.week_number}</td>
                <td className="px-4 py-3">{assignment.subject_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[assignment.status] ?? "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {assignment.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{assignment.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
