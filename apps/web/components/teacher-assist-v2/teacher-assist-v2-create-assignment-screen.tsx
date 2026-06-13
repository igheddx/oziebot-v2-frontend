"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  createV2ManualAssignment,
  fetchV2ManualAssignmentForm,
  fetchV2ManualAssignmentObjectives,
} from "@/lib/teacher-assist-v2-api";
import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import type { ManualAssignmentObjective } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2CreateAssignmentScreen() {
  const router = useRouter();
  const [form, setForm] = useState<Awaited<ReturnType<typeof fetchV2ManualAssignmentForm>> | null>(null);
  const [objectives, setObjectives] = useState<ManualAssignmentObjective[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [assignmentType, setAssignmentType] = useState("WRITTEN_ASSIGNMENT");
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2ManualAssignmentForm()
      .then((payload) => {
        setForm(payload);
        if (payload.week_ranges[0]) setWeekNumber(payload.week_ranges[0].week_start);
        if (payload.subjects[0]) setSubjectId(payload.subjects[0].subject_id);
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!subjectId || weekNumber < 1) {
      setObjectives([]);
      return;
    }
    void fetchV2ManualAssignmentObjectives(weekNumber, subjectId)
      .then((rows) => {
        setObjectives(rows);
        setSelectedObjectiveIds(rows.map((row) => row.education_objective_id));
      })
      .catch((nextError: Error) => setError(nextError.message));
  }, [subjectId, weekNumber]);

  const studentCount = form?.student_count ?? 0;

  const weekOptions = useMemo(() => {
    if (!form) return [];
    const maxWeeks = Math.max(...form.subjects.map((subject) => subject.period_count), 0);
    return Array.from({ length: maxWeeks }, (_, index) => index + 1);
  }, [form]);

  function toggleObjective(objectiveId: string) {
    setSelectedObjectiveIds((current) =>
      current.includes(objectiveId) ? current.filter((id) => id !== objectiveId) : [...current, objectiveId],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!subjectId || selectedObjectiveIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createV2ManualAssignment({
        title,
        description: description.trim() || null,
        week_number: weekNumber,
        subject_id: subjectId,
        education_objective_ids: selectedObjectiveIds,
        assignment_type: assignmentType,
        generate_cover_sheets: true,
      });
      if (created.cover_sheet?.download_url) {
        const coverSheetUrl =
          resolveTeacherAssistFileUrl(created.cover_sheet.download_url) ?? created.cover_sheet.download_url;
        window.open(coverSheetUrl, "_blank", "noopener,noreferrer");
      }
      router.push(`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(created.id)}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Loading assignment form...</p>;

  return (
    <div className="max-w-3xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/assignments" className="text-xs font-semibold text-sky-700">
          ← Back to assignments
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Create assignment</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record an assignment from outside TeacherAssist, link it to your week and TEKS, then download a Word
          cover-sheet file with one page per student ({studentCount} students).
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <form className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Assignment title</span>
          <input className="ta-input h-9 w-full" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Description (optional)</span>
          <textarea className="ta-input min-h-20 w-full" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Teaching week</span>
            <select className="ta-input h-9 w-full" value={weekNumber} onChange={(event) => setWeekNumber(Number(event.target.value))}>
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Subject</span>
            <select className="ta-input h-9 w-full" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {(form?.subjects ?? []).map((subject) => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.subject_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Assignment type</span>
            <select
              className="ta-input h-9 w-full"
              value={assignmentType}
              onChange={(event) => setAssignmentType(event.target.value)}
            >
              {(form?.assignment_types ?? []).map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">TEKS / objectives</h2>
          <p className="mt-1 text-xs text-slate-600">Select the standards this assignment addresses.</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {objectives.length === 0 ? (
              <p className="text-sm text-slate-600">No objectives found for this week and subject.</p>
            ) : (
              objectives.map((objective) => (
                <label key={objective.education_objective_id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedObjectiveIds.includes(objective.education_objective_id)}
                    onChange={() => toggleObjective(objective.education_objective_id)}
                  />
                  <span>
                    <span className="font-medium text-slate-900">{objective.objective_code ?? "Objective"}</span>
                    <span className="mt-0.5 block text-slate-600">{objective.description}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-3 text-sm text-sky-950">
          After you create this assignment, TeacherAssist will download a Word cover-sheet file with{" "}
          <strong>{studentCount} pages</strong> (one per student). Open it in Word and print, then staple each cover sheet
          to the front of the student&apos;s completed work before scanning and uploading.
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="ta-button-primary h-9 px-4 text-sm" disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create assignment and download cover sheets"}
          </button>
          <Link href="/teacher-assist-v2/assignments" className="ta-button-secondary inline-flex h-9 items-center px-4 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
