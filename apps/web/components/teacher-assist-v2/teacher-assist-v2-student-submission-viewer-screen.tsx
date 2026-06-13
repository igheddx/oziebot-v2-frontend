"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  acceptV2SubmissionGrade,
  extractV2StudentSubmission,
  fetchV2StudentSubmission,
  fetchV2SubmissionGradeAuditHistory,
  fetchV2SubmissionRubricScorecardHtml,
  generateV2SubmissionGradingDraft,
  modifyV2SubmissionGrade,
  openPrintableHtml,
  rejectV2SubmissionGrade,
  saveV2StudentSubmissionResponseText,
  saveV2SubmissionGradeReview,
  updateV2StudentSubmissionStatus,
} from "@/lib/teacher-assist-v2-api";
import { EmbeddedStudentWorkViewer } from "@/components/teacher-assist-v2/embedded-student-work-viewer";
import { MasteryLevelBadge } from "@/components/teacher-assist-v2/mastery-level-badge";
import {
  TeacherAssistV2RubricScoreEditor,
  totalsFromRubricSections,
  type RubricScoreSection,
} from "@/components/teacher-assist-v2/teacher-assist-v2-rubric-score-editor";
import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import type { GradeAuditEvent, GradingDraft, StudentSubmissionDetail } from "@/lib/teacher-assist-v2-types";

function GradingDraftPanel({
  draft,
  rubricSections,
  onRubricChange,
}: {
  draft: GradingDraft;
  rubricSections: RubricScoreSection[];
  onRubricChange: (sections: RubricScoreSection[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">AI suggested grade</h3>
          <p className="mt-1 text-xs text-slate-600">Draft only until you confirm.</p>
        </div>
        <p className="text-sm font-semibold text-slate-900">
          {draft.score}/{draft.max_score} ({draft.percentage}%)
        </p>
      </div>
      <div>
        <MasteryLevelBadge level={draft.mastery_level} label={draft.mastery_level_label} percentage={draft.percentage} />
      </div>

      <p className="text-xs text-slate-500">
        Provider: {draft.provider} · Confidence: {Math.round(draft.confidence_score * 100)}%
      </p>

      {rubricSections.length > 0 ? (
        <TeacherAssistV2RubricScoreEditor sections={rubricSections} onChange={onRubricChange} />
      ) : null}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher comment draft</h4>
        <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {draft.teacher_comment_draft}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objective evidence</h4>
        <ul className="mt-2 space-y-2">
          {draft.objective_evidence.map((item) => (
            <li key={item.objective_id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="font-medium text-slate-900">{item.objective_id}</p>
              <p className="mt-1 text-slate-700">{item.evidence}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AuditHistoryPanel({ events }: { events: GradeAuditEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Audit history</h2>
      <p className="mt-1 text-xs text-slate-600">AI draft history is preserved. Official grades reflect teacher decisions only.</p>
      <ul className="mt-3 space-y-2">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">{event.review_action}</p>
              <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
            </div>
            <p className="mt-1 text-slate-700">
              AI: {event.original_ai_score ?? "—"}/{event.original_ai_max_score ?? "—"} → Final: {event.final_score}/
              {event.final_max_score}
              {event.score_difference != null ? ` (${event.score_difference >= 0 ? "+" : ""}${event.score_difference})` : ""}
            </p>
            {event.teacher_override_reason ? (
              <p className="mt-1 text-xs text-slate-600">Override: {event.teacher_override_reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeacherAssistV2StudentSubmissionViewerScreen({
  submissionId: submissionIdProp,
}: { submissionId?: string } = {}) {
  const searchParams = useSearchParams();
  const submissionId = submissionIdProp ?? searchParams.get("id") ?? "";
  const [detail, setDetail] = useState<StudentSubmissionDetail | null>(null);
  const [auditEvents, setAuditEvents] = useState<GradeAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [rubricSections, setRubricSections] = useState<RubricScoreSection[]>([]);
  const [markingReady, setMarkingReady] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const rubricJson = useMemo(() => ({ sections: rubricSections }), [rubricSections]);

  const reload = async () => {
    const [submission, audit] = await Promise.all([
      fetchV2StudentSubmission(submissionId),
      fetchV2SubmissionGradeAuditHistory(submissionId).catch(() => [] as GradeAuditEvent[]),
    ]);
    setDetail(submission);
    setResponseText(submission.student_response_text ?? "");
    setAuditEvents(audit);
    if (submission.grading_draft) {
      const sections = submission.grading_draft.rubric_json?.sections ?? [];
      setRubricSections([...sections]);
      const totals = totalsFromRubricSections(sections);
      setScore(String(totals.score || submission.grading_draft.score));
      setMaxScore(String(totals.maxScore || submission.grading_draft.max_score));
      setTeacherComment(submission.assignment_grade?.teacher_comment ?? submission.grading_draft.teacher_comment_draft);
    }
  };

  const handleRubricChange = (sections: RubricScoreSection[]) => {
    setRubricSections(sections);
    const totals = totalsFromRubricSections(sections);
    if (totals.maxScore > 0) {
      setScore(String(totals.score));
      setMaxScore(String(totals.maxScore));
    }
  };

  useEffect(() => {
    if (!submissionId) return;
    void reload()
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [submissionId]);

  async function handleMarkReady() {
    if (!submissionId) return;
    setMarkingReady(true);
    setError(null);
    setMessage(null);
    try {
      await updateV2StudentSubmissionStatus(submissionId, "READY_FOR_GRADING");
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not mark ready for grading");
    } finally {
      setMarkingReady(false);
    }
  }

  async function handleGenerateDraft() {
    if (!submissionId) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await generateV2SubmissionGradingDraft(submissionId);
      await reload();
      setMessage("Grading draft generated. Teacher review required.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "AI grading failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept() {
    if (!submissionId || !detail?.grading_draft) return;
    setActionLoading("accept");
    setError(null);
    setMessage(null);
    try {
      await acceptV2SubmissionGrade(submissionId, {
        score: Number(score),
        max_score: Number(maxScore),
        teacher_comment: teacherComment,
        rubric_json: rubricJson,
      });
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Accept failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveDraft() {
    if (!submissionId || !detail?.grading_draft) return;
    setActionLoading("save");
    setError(null);
    setMessage(null);
    try {
      await saveV2SubmissionGradeReview(submissionId, {
        score: Number(score),
        max_score: Number(maxScore),
        teacher_comment: teacherComment,
        rubric_json: rubricJson,
        teacher_override_reason: overrideReason || null,
      });
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Save failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleModify() {
    if (!submissionId || !detail?.grading_draft) return;
    setActionLoading("modify");
    setError(null);
    setMessage(null);
    try {
      await modifyV2SubmissionGrade(submissionId, {
        score: Number(score),
        max_score: Number(maxScore),
        teacher_comment: teacherComment,
        rubric_json: rubricJson,
        teacher_override_reason: overrideReason,
      });
      setShowModify(false);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Modify failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!submissionId || !detail?.grading_draft) return;
    setActionLoading("reject");
    setError(null);
    setMessage(null);
    try {
      await rejectV2SubmissionGrade(submissionId, {
        score: Number(score),
        max_score: Number(maxScore),
        teacher_comment: teacherComment,
        rubric_json: rubricJson,
        teacher_override_reason: overrideReason || null,
      });
      setShowReject(false);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Reject failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePrintScorecard() {
    if (!submissionId) return;
    setActionLoading("print");
    setError(null);
    setMessage(null);
    try {
      const html = await fetchV2SubmissionRubricScorecardHtml(submissionId);
      openPrintableHtml(html);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not open rubric score card");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExtractText() {
    if (!submissionId) return;
    setActionLoading("extract");
    setError(null);
    setMessage(null);
    try {
      await extractV2StudentSubmission(submissionId);
      await reload();
      setMessage("File text extracted.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not extract student work text");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveResponseText() {
    if (!submissionId) return;
    setActionLoading("response-text");
    setError(null);
    setMessage(null);
    try {
      await saveV2StudentSubmissionResponseText(submissionId, responseText);
      await reload();
      setMessage("Manual response entered.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save student response text");
    } finally {
      setActionLoading(null);
    }
  }

  if (!submissionId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No submission selected.
      </div>
    );
  }

  if (loading) return <p className="text-sm text-slate-600">Loading student work...</p>;
  if (!detail) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error ?? "Submission not found."}
      </div>
    );
  }

  const draft = detail.grading_draft;
  const officialGrade = detail.assignment_grade?.is_official ? detail.assignment_grade : null;
  const downloadUrl = resolveTeacherAssistFileUrl(detail.download_url);
  const gradingReady = Boolean(detail.ai_grading_ready);

  return (
    <div className="max-w-6xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link
          href={`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(detail.assignment_id)}`}
          className="text-xs font-semibold text-sky-700"
        >
          ← Back to assignment
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Student #{detail.student_number ?? "—"}</h1>
        <p className="mt-1 text-sm text-slate-600">{detail.assignment_title}</p>
        {detail.page_range ? (
          <p className="mt-1 text-xs text-slate-500">Extracted from batch scan pages {detail.page_range}</p>
        ) : null}
        <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
          {detail.status} · {detail.match_method}
          {detail.teacher_viewed_for_review ? " · Viewed for review" : ""}
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}

      {officialGrade ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Official assignment grade</h2>
          <p className="mt-2 text-sm text-slate-700">
            {officialGrade.score}/{officialGrade.max_score} ({officialGrade.percentage}%) · {officialGrade.status} ·{" "}
            {officialGrade.review_action}
          </p>
          <div className="mt-2">
            <MasteryLevelBadge
              level={officialGrade.mastery_level}
              label={officialGrade.mastery_level_label}
              percentage={officialGrade.percentage}
            />
          </div>
          <p className="mt-2 text-sm text-slate-700">{officialGrade.teacher_comment}</p>
          {officialGrade.rubric_json?.sections?.length ? (
            <div className="mt-4">
              <TeacherAssistV2RubricScoreEditor
                sections={officialGrade.rubric_json.sections}
                onChange={() => undefined}
                readOnly
              />
            </div>
          ) : null}
          <button
            type="button"
            className="ta-button-secondary mt-3 inline-flex h-9 items-center px-4 text-sm"
            disabled={actionLoading != null}
            onClick={() => void handlePrintScorecard()}
          >
            Print rubric score card
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Confirmed {officialGrade.confirmed_at ? new Date(officialGrade.confirmed_at).toLocaleString() : "—"}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Student work</h2>
            <p className="mt-2 text-sm text-slate-700">{detail.original_filename}</p>
            <p className="mt-1 text-xs text-slate-500">
              {detail.extraction?.has_usable_text ? "Ready for AI" : "Needs extraction"}
            </p>
            <EmbeddedStudentWorkViewer
              previewUrl={detail.preview_url}
              mimeType={detail.mime_type}
              title="Student work preview"
            />
            {downloadUrl ? (
              <a href={downloadUrl} download className="mt-3 inline-flex text-sm font-medium text-sky-700">
                Download file
              </a>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Student response text</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Review extracted text or enter a manual response before real AI grading.
                </p>
              </div>
              <button
                type="button"
                className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
                disabled={actionLoading != null}
                onClick={() => void handleExtractText()}
              >
                {actionLoading === "extract" ? "Extracting..." : "Extract text"}
              </button>
            </div>
            {detail.extraction?.error_message ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {detail.extraction.error_message}
              </p>
            ) : null}
            {detail.ai_grading_blocker ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {detail.ai_grading_blocker}
              </p>
            ) : null}
            <textarea
              className="ta-input mt-3 min-h-48 w-full"
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
              placeholder="Student response text is required before AI grading."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="ta-button-primary inline-flex h-9 items-center px-4 text-sm"
                disabled={actionLoading != null}
                onClick={() => void handleSaveResponseText()}
              >
                {actionLoading === "response-text" ? "Saving..." : "Save response text"}
              </button>
              <p className="inline-flex items-center text-xs text-slate-500">
                {gradingReady ? "Ready for AI" : "Teacher review required before AI grading"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Assignment objectives</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {detail.objectives.map((objective) => (
                <li key={objective.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="font-medium text-slate-900">{objective.objective_id}</p>
                  <p className="mt-1 text-slate-700">{objective.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          {draft ? (
            <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
              <GradingDraftPanel draft={draft} rubricSections={rubricSections} onRubricChange={handleRubricChange} />

              {!officialGrade ? (
                <div className="mt-6 space-y-3 border-t border-sky-200 pt-4">
                  {(showModify || showReject) && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
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
                      {(showModify || showReject) && (
                        <label className="block space-y-1 text-sm">
                          <span className="font-medium text-slate-700">
                            Override reason {showModify ? "(required)" : "(optional)"}
                          </span>
                          <textarea className="ta-input min-h-20 w-full" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                        </label>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ta-button-primary inline-flex h-9 items-center px-4 text-sm"
                      disabled={actionLoading != null}
                      onClick={() => void handleAccept()}
                    >
                      {actionLoading === "accept" ? "Confirming…" : "Accept grade"}
                    </button>
                    <button
                      type="button"
                      className="ta-button-secondary inline-flex h-9 items-center px-4 text-sm"
                      disabled={actionLoading != null}
                      onClick={() => {
                        setShowModify((current) => !current);
                        setShowReject(false);
                      }}
                    >
                      Modify grade
                    </button>
                    <button
                      type="button"
                      className="ta-button-secondary inline-flex h-9 items-center px-4 text-sm"
                      disabled={actionLoading != null}
                      onClick={() => {
                        setShowReject((current) => !current);
                        setShowModify(false);
                      }}
                    >
                      Reject draft
                    </button>
                    <button
                      type="button"
                      className="ta-button-secondary inline-flex h-9 items-center px-4 text-sm"
                      disabled={actionLoading != null}
                      onClick={() => void handleSaveDraft()}
                    >
                      {actionLoading === "save" ? "Saving…" : "Save review"}
                    </button>
                  </div>

                  {showModify ? (
                    <button
                      type="button"
                      className="ta-button-primary inline-flex h-9 items-center px-4 text-sm"
                      disabled={actionLoading != null || !overrideReason.trim()}
                      onClick={() => void handleModify()}
                    >
                      {actionLoading === "modify" ? "Saving…" : "Confirm modified grade"}
                    </button>
                  ) : null}

                  {showReject ? (
                    <button
                      type="button"
                      className="ta-button-primary inline-flex h-9 items-center px-4 text-sm"
                      disabled={actionLoading != null || !teacherComment.trim()}
                      onClick={() => void handleReject()}
                    >
                      {actionLoading === "reject" ? "Saving…" : "Confirm manual grade"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : detail.status === "MATCHED" || detail.status === "MANUAL_MATCH" ? (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Ready for grading</h2>
              <p className="mt-1 text-sm text-slate-600">
                Confirm this student&apos;s extracted work before generating an AI grading draft.
              </p>
              <button
                type="button"
                className="ta-button-primary mt-3 inline-flex h-9 items-center px-4 text-sm"
                disabled={markingReady}
                onClick={() => void handleMarkReady()}
              >
                {markingReady ? "Saving…" : "Mark submission ready for grading"}
              </button>
            </section>
          ) : detail.status === "READY_FOR_GRADING" || gradingReady ? (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <h2 className="text-sm font-semibold text-slate-900">AI grading draft</h2>
              <p className="mt-1 text-sm text-slate-600">
                {gradingReady
                  ? "Student response used for grading is ready."
                  : "No draft yet for this submission."}
              </p>
              <button
                type="button"
                className="ta-button-primary mt-3 inline-flex h-9 items-center px-4 text-sm"
                disabled={generating || !gradingReady}
                onClick={() => void handleGenerateDraft()}
              >
                {generating ? "Generating…" : "Generate AI grading draft"}
              </button>
              {!gradingReady && detail.ai_grading_blocker ? (
                <p className="mt-2 text-xs text-amber-700">{detail.ai_grading_blocker}</p>
              ) : null}
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-sm text-slate-600">Mark submission ready for grading to generate an AI draft.</p>
            </section>
          )}
        </div>
      </div>

      <AuditHistoryPanel events={auditEvents} />
    </div>
  );
}
