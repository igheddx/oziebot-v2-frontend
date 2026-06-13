"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  acceptV2SubmissionGrade,
  fetchV2Assignment,
  fetchV2AssignmentReviewQueue,
  fetchV2StudentSubmission,
  fetchV2SubmissionRubricScorecardHtml,
  markV2SubmissionIncomplete,
  modifyV2SubmissionGrade,
  openPrintableHtml,
  uploadV2SubmissionSupplement,
} from "@/lib/teacher-assist-v2-api";
import { EmbeddedStudentWorkViewer } from "@/components/teacher-assist-v2/embedded-student-work-viewer";
import { MasteryLevelBadge } from "@/components/teacher-assist-v2/mastery-level-badge";
import {
  TeacherAssistV2RubricScoreEditor,
  totalsFromRubricSections,
  type RubricScoreSection,
} from "@/components/teacher-assist-v2/teacher-assist-v2-rubric-score-editor";
import type { AssignmentDetail, GradingDraft, StudentSubmissionDetail, StudentSubmissionSummary } from "@/lib/teacher-assist-v2-types";
import { resolveMasteryLevel, formatMasteryLevelLabel } from "@/lib/teacher-assist-v2-mastery";

function draftRubricSections(draft: GradingDraft | null | undefined): RubricScoreSection[] {
  return draft?.rubric_json?.sections ? [...draft.rubric_json.sections] : [];
}

export function TeacherAssistV2AssignmentReviewScreen({ assignmentId: assignmentIdProp }: { assignmentId?: string } = {}) {
  const searchParams = useSearchParams();
  const assignmentId = assignmentIdProp ?? searchParams.get("id") ?? "";
  const initialSubmissionId = searchParams.get("submission") ?? "";

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [queue, setQueue] = useState<StudentSubmissionSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detail, setDetail] = useState<StudentSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [rubricSections, setRubricSections] = useState<RubricScoreSection[]>([]);
  const [supplementFile, setSupplementFile] = useState<File | null>(null);

  const activeSubmission = queue[activeIndex] ?? null;

  const reloadQueue = useCallback(async () => {
    if (!assignmentId) return;
    const [assignmentDetail, reviewQueue] = await Promise.all([
      fetchV2Assignment(assignmentId),
      fetchV2AssignmentReviewQueue(assignmentId),
    ]);
    setAssignment(assignmentDetail);
    setQueue(reviewQueue);
    return reviewQueue;
  }, [assignmentId]);

  const loadSubmissionDetail = useCallback(async (submissionId: string) => {
    const submission = await fetchV2StudentSubmission(submissionId);
    setDetail(submission);
    if (submission.grading_draft) {
      const sections = draftRubricSections(submission.grading_draft);
      setRubricSections(sections);
      const totals = totalsFromRubricSections(sections);
      setScore(String(totals.score || submission.grading_draft.score));
      setMaxScore(String(totals.maxScore || submission.grading_draft.max_score));
      setTeacherComment(submission.assignment_grade?.teacher_comment ?? submission.grading_draft.teacher_comment_draft);
    } else {
      setRubricSections([]);
    }
  }, []);

  useEffect(() => {
    if (!assignmentId) return;
    void reloadQueue()
      .then((reviewQueue) => {
        if (!reviewQueue || reviewQueue.length === 0) return;
        const startIndex = initialSubmissionId
          ? Math.max(0, reviewQueue.findIndex((row) => row.id === initialSubmissionId))
          : Math.max(
              0,
              reviewQueue.findIndex((row) => row.status === "READY_FOR_REVIEW" || row.status === "NOT_UPLOADED"),
            );
        setActiveIndex(startIndex >= 0 ? startIndex : 0);
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [assignmentId, initialSubmissionId, reloadQueue]);

  useEffect(() => {
    if (!activeSubmission?.id) {
      setDetail(null);
      return;
    }
    void loadSubmissionDetail(activeSubmission.id).catch((nextError: Error) => setError(nextError.message));
  }, [activeSubmission?.id, loadSubmissionDetail]);

  const progress = useMemo(() => {
    if (queue.length === 0) return { resolved: 0, total: 0 };
    const resolved = queue.filter((row) => row.status === "CONFIRMED" || row.status === "INCOMPLETE").length;
    return { resolved, total: queue.length };
  }, [queue]);

  const rubricTotals = useMemo(() => totalsFromRubricSections(rubricSections), [rubricSections]);

  const handleRubricChange = (sections: RubricScoreSection[]) => {
    setRubricSections(sections);
    const totals = totalsFromRubricSections(sections);
    if (totals.maxScore > 0) {
      setScore(String(totals.score));
      setMaxScore(String(totals.maxScore));
    }
  };

  async function refreshAll() {
    const reviewQueue = await reloadQueue();
    const currentId = activeSubmission?.id;
    if (currentId && reviewQueue) {
      const nextIndex = reviewQueue.findIndex((row) => row.id === currentId);
      if (nextIndex >= 0) setActiveIndex(nextIndex);
      await loadSubmissionDetail(currentId);
    }
  }

  async function handleConfirmGrade() {
    if (!detail?.id || !detail.grading_draft) return;
    setActionLoading("confirm");
    setError(null);
    const rubricJson = { sections: rubricSections };
    const payload = {
      score: Number(score),
      max_score: Number(maxScore),
      teacher_comment: teacherComment,
      rubric_json: rubricJson,
    };
    try {
      if (showModify) {
        await modifyV2SubmissionGrade(detail.id, {
          ...payload,
          teacher_override_reason: overrideReason,
        });
      } else {
        await acceptV2SubmissionGrade(detail.id, payload);
      }
      await refreshAll();
      if (activeIndex < queue.length - 1) {
        setActiveIndex((current) => current + 1);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not confirm grade");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePrintScorecard() {
    if (!detail?.id) return;
    setActionLoading("print");
    setError(null);
    try {
      const html = await fetchV2SubmissionRubricScorecardHtml(detail.id);
      openPrintableHtml(html);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not open rubric score card");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkIncomplete() {
    if (!detail?.id) return;
    setActionLoading("incomplete");
    setError(null);
    try {
      await markV2SubmissionIncomplete(detail.id);
      await refreshAll();
      if (activeIndex < queue.length - 1) {
        setActiveIndex((current) => current + 1);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not mark incomplete");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSupplementUpload() {
    if (!detail?.id || !supplementFile) return;
    setActionLoading("upload");
    setError(null);
    try {
      await uploadV2SubmissionSupplement(detail.id, supplementFile);
      setSupplementFile(null);
      await refreshAll();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Upload failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (!assignmentId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No assignment selected.
      </div>
    );
  }

  if (loading) return <p className="text-sm text-slate-600">Loading review queue...</p>;

  if (!assignment || queue.length === 0) {
    return (
      <div className="max-w-3xl space-y-3">
        <Link href={`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(assignmentId)}`} className="text-xs font-semibold text-sky-700">
          ← Back to assignment
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error ?? "No student submissions are ready for review yet. Upload student work first."}
        </div>
      </div>
    );
  }

  const draft = detail?.grading_draft;
  const officialGrade = detail?.assignment_grade?.is_official ? detail.assignment_grade : null;
  const adjustedPercentage =
    showModify && maxScore && Number(maxScore) > 0 ? (Number(score) / Number(maxScore)) * 100 : rubricTotals.maxScore > 0
      ? (rubricTotals.score / rubricTotals.maxScore) * 100
      : null;
  const adjustedMasteryLevel = adjustedPercentage != null ? resolveMasteryLevel(adjustedPercentage) : null;
  const isMissingWork = detail?.status === "NOT_UPLOADED";
  const isReviewable = detail?.status === "READY_FOR_REVIEW";
  const isResolved = detail?.status === "CONFIRMED" || detail?.status === "INCOMPLETE";
  const usesRubric =
    assignment.assignment_type === "WRITING" || assignment.assignment_type === "WRITTEN_ASSIGNMENT";

  return (
    <div className="max-w-6xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link href={`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(assignmentId)}`} className="text-xs font-semibold text-sky-700">
          ← Back to assignment
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Review: {assignment.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Student {activeIndex + 1} of {queue.length} · {progress.resolved}/{progress.total} resolved
        </p>
        {assignment.status === "COMPLETED" ? (
          <p className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Assignment completed
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ta-button-secondary h-9 px-3 text-sm"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="ta-button-secondary h-9 px-3 text-sm"
            disabled={activeIndex >= queue.length - 1}
            onClick={() => setActiveIndex((current) => Math.min(queue.length - 1, current + 1))}
          >
            Next →
          </button>
        </div>
        <p className="text-sm font-medium text-slate-900">
          Student #{detail?.student_number ?? activeSubmission?.student_number ?? "—"}
          <span className="ml-2 text-xs font-normal text-slate-500">{detail?.status ?? activeSubmission?.status}</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Student work</h2>
          {isMissingWork ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              Assignment was not uploaded for this student. Upload a single file here or mark the submission incomplete.
            </div>
          ) : detail?.preview_url ? (
            <EmbeddedStudentWorkViewer
              previewUrl={detail.preview_url}
              mimeType={detail.mime_type}
              title={`Student #${detail.student_number ?? ""} work`}
            />
          ) : (
            <p className="mt-3 text-sm text-slate-600">Preview unavailable.</p>
          )}
          {detail?.page_range ? <p className="mt-2 text-xs text-slate-500">Pages {detail.page_range}</p> : null}
        </section>

        <section className="space-y-4">
          {isMissingWork ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Missing submission</h3>
              <label className="mt-3 block space-y-1 text-sm">
                <span className="font-medium text-slate-700">Upload student work</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="block w-full text-sm"
                  onChange={(event) => setSupplementFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ta-button-primary h-9 px-4 text-sm"
                  disabled={!supplementFile || actionLoading != null}
                  onClick={() => void handleSupplementUpload()}
                >
                  {actionLoading === "upload" ? "Uploading…" : "Upload and grade"}
                </button>
                <button
                  type="button"
                  className="ta-button-secondary h-9 px-4 text-sm"
                  disabled={actionLoading != null}
                  onClick={() => void handleMarkIncomplete()}
                >
                  Mark incomplete
                </button>
              </div>
            </div>
          ) : null}

          {officialGrade ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Confirmed grade</h3>
              <p className="mt-2 text-sm text-slate-700">
                {officialGrade.score}/{officialGrade.max_score} ({officialGrade.percentage}%)
              </p>
              <div className="mt-2">
                <MasteryLevelBadge
                  level={officialGrade.mastery_level}
                  label={officialGrade.mastery_level_label}
                  percentage={officialGrade.percentage}
                />
              </div>
              {usesRubric && officialGrade.rubric_json?.sections?.length ? (
                <div className="mt-4">
                  <TeacherAssistV2RubricScoreEditor
                    sections={officialGrade.rubric_json.sections}
                    onChange={() => undefined}
                    readOnly
                  />
                </div>
              ) : null}
              <p className="mt-2 text-sm text-slate-700">{officialGrade.teacher_comment}</p>
              <button
                type="button"
                className="ta-button-secondary mt-3 h-9 px-4 text-sm"
                disabled={actionLoading != null}
                onClick={() => void handlePrintScorecard()}
              >
                Print rubric score card
              </button>
            </div>
          ) : null}

          {isReviewable && draft ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Confirm grade</h3>
                  <p className="mt-1 text-xs text-slate-600">Review rubric scores, adjust if needed, then confirm.</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {score}/{maxScore}
                  {adjustedPercentage != null ? ` (${adjustedPercentage.toFixed(1)}%)` : ""}
                </p>
              </div>
              {adjustedMasteryLevel ? (
                <div className="mt-2">
                  <MasteryLevelBadge
                    level={adjustedMasteryLevel}
                    label={formatMasteryLevelLabel(adjustedMasteryLevel)}
                    percentage={adjustedPercentage ?? undefined}
                  />
                </div>
              ) : null}

              {usesRubric && rubricSections.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                  <TeacherAssistV2RubricScoreEditor sections={rubricSections} onChange={handleRubricChange} />
                </div>
              ) : null}

              {showModify ? (
                <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Score</span>
                    <input className="ta-input h-9" type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Max score</span>
                    <input className="ta-input h-9" type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Teacher comment</span>
                    <textarea className="ta-input min-h-24 w-full" value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Override reason</span>
                    <textarea className="ta-input min-h-20 w-full" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                  </label>
                </div>
              ) : (
                <label className="mt-4 block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Teacher comment</span>
                  <textarea className="ta-input min-h-24 w-full" value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} />
                </label>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ta-button-primary h-9 px-4 text-sm"
                  disabled={actionLoading != null || !teacherComment.trim() || (showModify && !overrideReason.trim())}
                  onClick={() => void handleConfirmGrade()}
                >
                  {actionLoading === "confirm" ? "Confirming…" : "Confirm grade"}
                </button>
                <button
                  type="button"
                  className="ta-button-secondary h-9 px-4 text-sm"
                  disabled={actionLoading != null}
                  onClick={() => setShowModify((current) => !current)}
                >
                  {showModify ? "Use rubric totals" : "Adjust score manually"}
                </button>
              </div>
            </div>
          ) : null}

          {isReviewable && !draft ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
              Auto-grading is still processing for this student.
            </div>
          ) : null}

          {isResolved && !officialGrade ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
              This student has been marked {detail?.status?.toLowerCase()}.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
