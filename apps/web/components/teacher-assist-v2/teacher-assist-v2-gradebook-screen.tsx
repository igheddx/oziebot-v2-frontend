"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MasteryLevelBadge } from "@/components/teacher-assist-v2/mastery-level-badge";
import {
  createV2GradebookGridAssignment,
  downloadV2GradebookGridCsv,
  fetchV2GradebookGrid,
  fetchV2GradebookGridForm,
  fetchV2ManualAssignmentObjectives,
  saveV2GradebookGridCell,
} from "@/lib/teacher-assist-v2-api";
import type { GradebookGrid, GradebookGridCell, GradebookGridForm, ManualAssignmentObjective } from "@/lib/teacher-assist-v2-types";

function GridCellDisplay({ cell }: { cell: GradebookGridCell }) {
  if (cell.mastery_level === "missing") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-slate-500">—</span>
        <MasteryLevelBadge level={cell.mastery_level} label={cell.mastery_level_label} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-slate-900">{cell.percentage != null ? `${cell.percentage}%` : "—"}</span>
      <MasteryLevelBadge level={cell.mastery_level} label={cell.mastery_level_label} percentage={cell.percentage ?? undefined} />
    </div>
  );
}

export function TeacherAssistV2GradebookScreen() {
  const [form, setForm] = useState<GradebookGridForm | null>(null);
  const [grid, setGrid] = useState<GradebookGrid | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [objectives, setObjectives] = useState<ManualAssignmentObjective[]>([]);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentWeek, setNewAssignmentWeek] = useState(1);
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>([]);
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  const selectedSubject = useMemo(
    () => form?.subjects.find((row) => row.subject_id === selectedSubjectId) ?? null,
    [form, selectedSubjectId],
  );

  const loadGrid = useCallback(async (subjectId: string, gradingPeriodId?: string) => {
    setGridLoading(true);
    setError(null);
    try {
      const nextGrid = await fetchV2GradebookGrid(subjectId, gradingPeriodId || null);
      setGrid(nextGrid);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load gradebook grid.");
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchV2GradebookGridForm()
      .then((nextForm) => {
        setForm(nextForm);
        const firstSubject = nextForm.subjects[0];
        if (firstSubject) {
          setSelectedSubjectId(firstSubject.subject_id);
          const firstPeriod = firstSubject.grading_periods[0];
          setSelectedPeriodId(firstPeriod?.grading_period_id ?? "");
        }
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;
    void loadGrid(selectedSubjectId, selectedPeriodId || undefined);
  }, [selectedSubjectId, selectedPeriodId, loadGrid]);

  useEffect(() => {
    if (!showAddAssignment || !selectedSubjectId) return;
    void fetchV2ManualAssignmentObjectives(newAssignmentWeek, selectedSubjectId)
      .then(setObjectives)
      .catch(() => setObjectives([]));
  }, [showAddAssignment, selectedSubjectId, newAssignmentWeek]);

  async function handleCellSave(assignmentId: string, studentNumber: number) {
    const raw = window.prompt(`Enter score (0-100) for student #${studentNumber}:`, "");
    if (raw == null || raw.trim() === "") return;
    const score = Number(raw);
    if (Number.isNaN(score) || score < 0 || score > 100) {
      window.alert("Enter a number from 0 to 100.");
      return;
    }
    try {
      await saveV2GradebookGridCell({
        assignment_id: assignmentId,
        student_number: studentNumber,
        score,
        max_score: 100,
      });
      if (selectedSubjectId) {
        await loadGrid(selectedSubjectId, selectedPeriodId || undefined);
      }
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Could not save grade.");
    }
  }

  async function handleCreateAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSubjectId || !newAssignmentTitle.trim() || selectedObjectiveIds.length === 0) return;
    setCreatingAssignment(true);
    try {
      await createV2GradebookGridAssignment({
        title: newAssignmentTitle.trim(),
        week_number: newAssignmentWeek,
        subject_id: selectedSubjectId,
        education_objective_ids: selectedObjectiveIds,
      });
      setShowAddAssignment(false);
      setNewAssignmentTitle("");
      setSelectedObjectiveIds([]);
      await loadGrid(selectedSubjectId, selectedPeriodId || undefined);
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Could not create assignment.");
    } finally {
      setCreatingAssignment(false);
    }
  }

  async function handleExport() {
    if (!selectedSubjectId) return;
    setExporting(true);
    try {
      await downloadV2GradebookGridCsv(selectedSubjectId, selectedPeriodId || null);
    } catch (nextError) {
      window.alert(nextError instanceof Error ? nextError.message : "Could not export gradebook.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Loading gradebook...</p>;
  if (error && !grid) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>;
  }
  if (!form || form.subjects.length === 0) {
    return <p className="text-sm text-slate-600">Complete pacing setup to use the subject gradebook.</p>;
  }

  return (
    <div className="space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Subject gradebook</h1>
        <p className="mt-1 text-sm text-slate-600">
          Spreadsheet-style grading by subject and 9-week period. Assignment scores roll up to TEKS mastery (M / D / B /
          Missing).
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Subject</span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={selectedSubjectId}
            onChange={(event) => {
              const subjectId = event.target.value;
              setSelectedSubjectId(subjectId);
              const subject = form.subjects.find((row) => row.subject_id === subjectId);
              setSelectedPeriodId(subject?.grading_periods[0]?.grading_period_id ?? "");
            }}
          >
            {form.subjects.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_id}>
                {subject.subject_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Grading period</span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={selectedPeriodId}
            onChange={(event) => setSelectedPeriodId(event.target.value)}
          >
            {(selectedSubject?.grading_periods ?? []).map((period) => (
              <option key={period.grading_period_id ?? period.title} value={period.grading_period_id ?? ""}>
                {period.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => setShowAddAssignment(true)}
        >
          Add assignment
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>

      {gridLoading ? <p className="text-sm text-slate-600">Loading grid…</p> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

      {grid && !gridLoading ? (
        grid.teks_groups.length === 0 ? (
          <p className="text-sm text-slate-600">
            No TEKS-tagged assignments in this period yet. Add an assignment or create work in TeacherAssist with TEKS
            linked.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80">
            <table className="min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2" rowSpan={3}>
                    Student
                  </th>
                  {grid.teks_groups.map((group) => (
                    <th
                      key={group.objective_id}
                      className="border-l border-slate-200 px-3 py-2 text-center normal-case"
                      colSpan={group.assignments.length + 1}
                    >
                      <div className="font-semibold text-slate-800">{group.objective_code}</div>
                      <div className="mt-1 text-[11px] font-normal leading-snug text-slate-600">
                        {group.objective_description ?? "TEKS objective"}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-200 bg-white text-xs text-slate-600">
                  {grid.teks_groups.flatMap((group) => [
                    ...group.assignments.map((assignment) => (
                      <th key={assignment.column_key} className="min-w-[9rem] border-l border-slate-100 px-2 py-2 align-bottom">
                        <div className="font-medium text-slate-800">{assignment.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                            {group.objective_code}
                          </span>
                          <span className="text-[11px] text-slate-500">Wk {assignment.week_number}</span>
                        </div>
                      </th>
                    )),
                    <th
                      key={`${group.objective_id}-summary`}
                      className="min-w-[6rem] border-l border-amber-200 bg-amber-50 px-2 py-2 align-bottom text-amber-900"
                    >
                      <div>TEKS mastery</div>
                      <div className="mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200 inline-block">
                        {group.objective_code}
                      </div>
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.student_number} className="border-b border-slate-100 last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-900">{row.student_label}</td>
                    {grid.teks_groups.flatMap((group) => [
                      ...group.assignments.map((assignment) => {
                        const cell = row.cells[assignment.column_key];
                        return (
                          <td
                            key={assignment.column_key}
                            className="border-l border-slate-100 px-2 py-2 text-center"
                          >
                            <button
                              type="button"
                              className="w-full rounded-lg px-1 py-1 hover:bg-slate-50"
                              onClick={() => void handleCellSave(assignment.assignment_id, row.student_number)}
                              title="Click to enter or update grade"
                            >
                              <GridCellDisplay cell={cell} />
                            </button>
                          </td>
                        );
                      }),
                      <td
                        key={`${group.objective_id}-${row.student_number}`}
                        className="border-l border-amber-200 bg-amber-50/70 px-2 py-2 text-center"
                      >
                        <GridCellDisplay cell={row.cells[`teks:${group.objective_id}`]} />
                      </td>,
                    ])}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {showAddAssignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onSubmit={(event) => void handleCreateAssignment(event)}
          >
            <h2 className="text-lg font-semibold text-slate-900">Add gradebook assignment</h2>
            <p className="mt-1 text-sm text-slate-600">Creates a TEKS-mapped assignment column for this subject and period.</p>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Title</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={newAssignmentTitle}
                onChange={(event) => setNewAssignmentTitle(event.target.value)}
                required
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Week in pacing plan</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={newAssignmentWeek}
                onChange={(event) => setNewAssignmentWeek(Number(event.target.value) || 1)}
              />
            </label>
            <fieldset className="mt-3">
              <legend className="text-sm font-medium text-slate-700">TEKS objectives</legend>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {objectives.length === 0 ? (
                  <p className="text-sm text-slate-500">No objectives for this week.</p>
                ) : (
                  objectives.map((objective) => (
                    <label key={objective.education_objective_id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedObjectiveIds.includes(objective.education_objective_id)}
                        onChange={(event) => {
                          setSelectedObjectiveIds((current) =>
                            event.target.checked
                              ? [...current, objective.education_objective_id]
                              : current.filter((value) => value !== objective.education_objective_id),
                          );
                        }}
                      />
                      <span>
                        <strong>{objective.objective_code}</strong> {objective.description}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setShowAddAssignment(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white"
                disabled={creatingAssignment}
              >
                {creatingAssignment ? "Adding…" : "Add assignment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
