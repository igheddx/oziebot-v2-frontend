"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  acceptAllViewedV2SubmissionGrades,
  downloadV2AssignmentRubricScoreReportDocx,
  fetchV2Assignment,
  fetchV2AssignmentSubmissions,
  generateV2AssignmentCoverSheets,
  generateV2AssignmentGradingDrafts,
  generateV2SubmissionGradingDraft,
  manualMatchV2StudentSubmission,
  updateV2StudentSubmissionStatus,
  uploadV2AssignmentSubmissionBatch,
} from "@/lib/teacher-assist-v2-api";
import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import { MasteryLevelBadge } from "@/components/teacher-assist-v2/mastery-level-badge";
import type { AssignmentDetail, StudentSubmissionSummary } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2AssignmentViewerScreen({ assignmentId: assignmentIdProp }: { assignmentId?: string } = {}) {
  const searchParams = useSearchParams();
  const assignmentId = assignmentIdProp ?? searchParams.get("id") ?? "";
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStudentNumber, setUploadStudentNumber] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [manualStudentBySubmission, setManualStudentBySubmission] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [gradingAll, setGradingAll] = useState(false);
  const [coverSheetLoading, setCoverSheetLoading] = useState(false);
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!assignmentId) return;
    const [assignmentDetail, submissionRows] = await Promise.all([
      fetchV2Assignment(assignmentId),
      fetchV2AssignmentSubmissions(assignmentId),
    ]);
    setDetail(assignmentDetail);
    setSubmissions(submissionRows);
  }, [assignmentId]);

  useEffect(() => {
    if (!assignmentId) return;
    void reload()
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [assignmentId, reload]);

  async function handlePrintCoverSheets() {
    if (!assignmentId) return;
    setCoverSheetLoading(true);
    setActionError(null);
    try {
      const coverSheet = detail?.cover_sheet ?? (await generateV2AssignmentCoverSheets(assignmentId));
      if (!coverSheet?.download_url) {
        throw new Error("Cover sheets could not be generated.");
      }
      const coverSheetUrl = resolveTeacherAssistFileUrl(coverSheet.download_url) ?? coverSheet.download_url;
      window.open(coverSheetUrl, "_blank", "noopener,noreferrer");
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Could not open cover sheets.");
    } finally {
      setCoverSheetLoading(false);
    }
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!assignmentId || uploadFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setActionError(null);
    const studentNumber = uploadStudentNumber.trim() ? Number(uploadStudentNumber) : undefined;
    try {
      for (let index = 0; index < uploadFiles.length; index += 1) {
        setUploadProgress(Math.round((index / uploadFiles.length) * 100));
        await uploadV2AssignmentSubmissionBatch(
          assignmentId,
          uploadFiles[index],
          studentNumber ? { student_number: studentNumber } : undefined,
        );
      }
      setUploadProgress(100);
      setUploadFiles([]);
      setUploadStudentNumber("");
      await reload();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Upload failed";
      setUploadError(
        message.toLowerCase().includes("not authenticated")
          ? `${message} Refresh the page and log in again if needed.`
          : message,
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleManualMatch(submissionId: string) {
    const value = manualStudentBySubmission[submissionId];
    if (!value) return;
    setActionError(null);
    try {
      await manualMatchV2StudentSubmission(submissionId, Number(value));
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Manual match failed");
    }
  }

  async function handleMarkReady(submissionId: string) {
    setActionError(null);
    try {
      await updateV2StudentSubmissionStatus(submissionId, "READY_FOR_GRADING");
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Status update failed");
    }
  }

  async function handleGenerateAllGrades() {
    if (!assignmentId) return;
    setGradingAll(true);
    setActionError(null);
    try {
      await generateV2AssignmentGradingDrafts(assignmentId);
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "AI grading failed");
    } finally {
      setGradingAll(false);
    }
  }

  async function handleGenerateSubmissionGrade(submissionId: string) {
    setGradingSubmissionId(submissionId);
    setActionError(null);
    try {
      await generateV2SubmissionGradingDraft(submissionId);
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "AI grading failed");
    } finally {
      setGradingSubmissionId(null);
    }
  }

  async function handleAcceptAllViewed() {
    if (!assignmentId) return;
    setBulkAccepting(true);
    setActionError(null);
    try {
      await acceptAllViewedV2SubmissionGrades(assignmentId);
      await reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Bulk accept failed");
    } finally {
      setBulkAccepting(false);
    }
  }

  async function handlePrintClassRubricReport() {
    if (!assignmentId) return;
    setReportLoading(true);
    setActionError(null);
    try {
      await downloadV2AssignmentRubricScoreReportDocx(assignmentId);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Could not download class rubric report.");
    } finally {
      setReportLoading(false);
    }
  }

  if (!assignmentId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No assignment selected.{" "}
        <Link href="/teacher-assist-v2/assignments" className="font-semibold text-sky-700">
          View all assignments
        </Link>
        .
      </div>
    );
  }

  if (loading) return <p className="text-sm text-slate-600">Loading assignment...</p>;
  if (!detail) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error ?? "Assignment not found."}
      </div>
    );
  }

  const summary = detail.submission_summary;
  const completion = detail.completion_summary;
  const gradeReviews = detail.grade_reviews ?? [];
  const gradebookSummary = detail.gradebook_summary;
  const objectivePerformance = detail.objective_performance ?? [];
  const viewedDraftCount = gradeReviews.filter(
    (row) => row.has_grading_draft && row.teacher_viewed && !row.official_score,
  ).length;
  const supportsRubricReport =
    detail.assignment_type === "WRITING" || detail.assignment_type === "WRITTEN_ASSIGNMENT";
  const canPrintClassRubricReport = Boolean(detail.rubric_score_report_available);

  return (
    <div className="max-w-4xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/assignments" className="text-xs font-semibold text-sky-700">
          ← All assignments
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{detail.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {detail.assignment_type.replaceAll("_", " ")} · Week {detail.week_number} · {detail.subject_name ?? "Subject"}
        </p>
        <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
          {detail.status}
          {detail.creation_origin === "TEACHER_MANUAL" ? " · Teacher-created" : ""}
        </p>
      </header>

      {supportsRubricReport && canPrintClassRubricReport ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Class rubric score report</h2>
              <p className="mt-1 text-sm text-slate-600">
                Download one Word document with rubric scores for every confirmed student submission.
              </p>
            </div>
            <button
              type="button"
              className="ta-button-primary h-9 px-4 text-sm"
              disabled={reportLoading}
              onClick={() => void handlePrintClassRubricReport()}
            >
              {reportLoading ? "Preparing…" : "Download class rubric report (Word)"}
            </button>
          </div>
        </section>
      ) : supportsRubricReport ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Class rubric score report</h2>
          <p className="mt-1 text-sm text-amber-900">
            {detail.rubric_score_report_blocker ??
              "Every submission in the list below must be Confirmed or Incomplete before the class report is ready."}
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Per-student score cards are still available from each student&apos;s review page after you confirm their grade.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Student cover sheets</h2>
            <p className="mt-1 text-sm text-slate-600">
              Download a Word file with one QR cover sheet per student, staple to each paper stack, then scan and upload
              for automatic student matching.
            </p>
            {detail.cover_sheet ? (
              <p className="mt-2 text-xs text-slate-500">
                Ready for {detail.cover_sheet.student_count} students · {detail.cover_sheet.pages_per_student} page each
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="ta-button-primary h-9 px-4 text-sm"
            disabled={coverSheetLoading}
            onClick={() => void handlePrintCoverSheets()}
          >
            {coverSheetLoading ? "Preparing…" : detail.cover_sheet ? "Download cover sheets (Word)" : "Generate cover sheets (Word)"}
          </button>
        </div>
      </section>

      {gradebookSummary ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Gradebook sync</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Confirmed grades</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{gradebookSummary.confirmed_grades_count}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sync status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{gradebookSummary.gradebook_sync_status}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Gradebook records</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{gradebookSummary.gradebook_records_count}</p>
            </div>
          </div>
        </section>
      ) : null}

      {objectivePerformance.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Objective performance</h2>
          <div className="mt-3 space-y-3">
            {objectivePerformance.map((row) => (
              <div key={row.objective_id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <p className="font-semibold text-slate-900">{row.objective_code}</p>
                <p className="mt-1 text-slate-700">{row.description}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-4">
                  <div><dt className="text-xs text-slate-500">Students assessed</dt><dd className="font-medium">{row.students_assessed}</dd></div>
                  <div><dt className="text-xs text-slate-500">Mastery</dt><dd className="font-medium">{row.mastery_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">Developing</dt><dd className="font-medium">{row.developing_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">Beginning</dt><dd className="font-medium">{row.beginning_count}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {completion ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Assignment completion</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Students assigned", completion.students_assigned_count],
              ["Submissions received", completion.submissions_received_count],
              ["AI drafts generated", completion.ai_drafts_generated_count],
              ["Grades confirmed", completion.grades_confirmed_count],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Submitted", summary.submitted_count],
            ["Ready to review", summary.ready_for_review_count ?? summary.ready_for_grading_count],
            ["Confirmed", summary.confirmed_count ?? 0],
            ["Not uploaded", summary.not_uploaded_count ?? 0],
            ["Incomplete", summary.incomplete_count ?? 0],
          ].map(([label, count]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{count}</p>
            </div>
          ))}
        </section>
      ) : null}

      {(summary?.ready_for_review_count ?? summary?.ready_for_grading_count ?? 0) > 0 || submissions.length > 0 ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Review and confirm grades</h2>
              <p className="mt-1 text-sm text-slate-600">
                Uploads are split by QR code, auto-graded, then queued for your review. Confirm each student in the
                embedded viewer. Grades go to the gradebook only after you confirm.
              </p>
            </div>
            <Link
              href={`/teacher-assist-v2/assignments/review?id=${encodeURIComponent(assignmentId)}`}
              className="ta-button-primary inline-flex h-9 items-center px-4 text-sm"
            >
              Open review
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Review grades</h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirm official grades after reviewing AI drafts. Bulk accept only applies to submissions you have opened.
            </p>
          </div>
          <button
            type="button"
            className="ta-button-secondary inline-flex h-9 items-center px-4 text-sm"
            disabled={bulkAccepting || viewedDraftCount === 0}
            onClick={() => void handleAcceptAllViewed()}
          >
            {bulkAccepting ? "Accepting…" : `Accept all viewed drafts (${viewedDraftCount})`}
          </button>
        </div>

  
      {gradebookSummary ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Gradebook sync</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Confirmed grades</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{gradebookSummary.confirmed_grades_count}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sync status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{gradebookSummary.gradebook_sync_status}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Gradebook records</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{gradebookSummary.gradebook_records_count}</p>
            </div>
          </div>
        </section>
      ) : null}

      {objectivePerformance.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Objective performance</h2>
          <div className="mt-3 space-y-3">
            {objectivePerformance.map((row) => (
              <div key={row.objective_id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <p className="font-semibold text-slate-900">{row.objective_code}</p>
                <p className="mt-1 text-slate-700">{row.description}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-4">
                  <div><dt className="text-xs text-slate-500">Students assessed</dt><dd className="font-medium">{row.students_assessed}</dd></div>
                  <div><dt className="text-xs text-slate-500">Mastery</dt><dd className="font-medium">{row.mastery_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">Developing</dt><dd className="font-medium">{row.developing_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">Beginning</dt><dd className="font-medium">{row.beginning_count}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {completion ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Ready for review", completion.ready_for_review_count],
              ["Reviewed", completion.reviewed_count],
              ["Confirmed", completion.confirmed_count],
              ["Rejected", completion.rejected_count],
              ["Pending", completion.pending_count],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        ) : null}

        {gradeReviews.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No submissions available for grade review yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student #</th>
                  <th className="px-4 py-3">Draft score</th>
                  <th className="px-4 py-3">Draft mastery</th>
                  <th className="px-4 py-3">Confirmed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Confirmed by</th>
                  <th className="px-4 py-3">Confirmed date</th>
                  <th className="px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {gradeReviews.map((row) => (
                  <tr key={row.student_submission_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">{row.student_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.draft_score != null ? `${row.draft_score}/${row.draft_max_score}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.draft_percentage != null || row.draft_mastery_level ? (
                        <MasteryLevelBadge
                          level={row.draft_mastery_level}
                          label={row.draft_mastery_level_label}
                          percentage={row.draft_percentage}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.official_score != null ? (
                        <div className="space-y-1">
                          <p>
                            {row.official_score}/{row.official_max_score}
                          </p>
                          <MasteryLevelBadge
                            level={row.official_mastery_level}
                            label={row.official_mastery_level_label}
                            percentage={row.official_percentage}
                          />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{row.review_status}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.confirmed_by ? "Teacher" : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.confirmed_at ? new Date(row.confirmed_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/teacher-assist-v2/assignments/review?id=${encodeURIComponent(assignmentId)}&submission=${encodeURIComponent(row.student_submission_id)}`}
                        className="font-medium text-sky-700"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Student work uploads</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload a scanned PDF or image batch for this assignment. Leave <strong>Student #</strong> blank for
          multi-student packet scans — the system splits by QR code, auto-grades each student, and creates placeholder
          rows for roster students who were not included in the scan.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Uploads with QR codes for a different assignment are rejected. Google Form imports match by student number
          instead of QR codes.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleUpload}>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">File (PDF or image)</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="block w-full text-sm"
              onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}
            />
            {uploadFiles.length > 0 ? (
              <p className="text-xs text-slate-600">
                {uploadFiles.length} file{uploadFiles.length === 1 ? "" : "s"} selected
              </p>
            ) : null}
          </label>
          <label className="block max-w-xs space-y-1 text-sm">
            <span className="font-medium text-slate-700">Student # (optional)</span>
            <input
              className="ta-input h-9"
              type="number"
              min={1}
              value={uploadStudentNumber}
              onChange={(event) => setUploadStudentNumber(event.target.value)}
              placeholder="Leave blank for QR auto-match"
            />
            <p className="text-xs text-slate-600">
              Leave blank when uploading a scanned PDF with QR codes — the upload will detect each student from the QR
              codes in the file. If you enter a student number, every selected file is assigned to that student only.
            </p>
          </label>
          {uploadProgress != null ? (
            <p className="text-xs text-slate-600">Uploading… {uploadProgress}%</p>
          ) : null}
          {uploadError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{uploadError}</div>
          ) : null}
          <button type="submit" className="ta-button-primary inline-flex h-9 items-center px-4 text-sm" disabled={uploadFiles.length === 0 || uploading}>
            {uploading ? "Uploading…" : "Upload student work"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Submissions</h2>
        {actionError ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionError}</div>
        ) : null}
        {submissions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No student submissions yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student #</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="px-4 py-3">
                      {submission.student_number ?? "—"}
                      {submission.page_range ? (
                        <p className="mt-1 text-xs text-slate-500">Pages {submission.page_range}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{submission.status}</td>
                    <td className="px-4 py-3">{submission.match_method}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(submission.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/teacher-assist-v2/assignments/review?id=${encodeURIComponent(assignmentId)}&submission=${encodeURIComponent(submission.id)}`}
                        className="text-sky-700 font-medium"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Assignment information</h2>
        {detail.description ? <p className="mt-2 text-sm text-slate-700">{detail.description}</p> : null}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Subject</dt>
            <dd className="font-medium text-slate-900">{detail.subject_name ?? detail.subject_id}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Week</dt>
            <dd className="font-medium text-slate-900">Week {detail.week_number}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Linked instructional plan</h2>
        <Link
          href={`/teacher-assist-v2/packages/view?id=${encodeURIComponent(detail.instructional_plan_id)}`}
          className="mt-2 inline-flex text-sm font-medium text-sky-700"
        >
          {detail.instructional_plan_title}
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Linked objectives</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.objectives.map((objective) => (
            <li key={objective.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="font-medium text-slate-900">{objective.objective_id}</p>
              <p className="mt-1 text-slate-700">{objective.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Linked artifacts</h2>
        {detail.artifacts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No artifacts linked yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.artifacts.map((artifact) => (
              <li key={artifact.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{artifact.title}</p>
                <p className="text-xs text-slate-500">{artifact.artifact_type}</p>
                {artifact.download_url ? (
                  <a
                    href={resolveTeacherAssistFileUrl(artifact.download_url) ?? artifact.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs text-sky-700"
                  >
                    Download
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
