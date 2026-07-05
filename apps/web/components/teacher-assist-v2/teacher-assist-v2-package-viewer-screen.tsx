"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import { closeOutV2InstructionalPackage, fetchV2InstructionalPackage } from "@/lib/teacher-assist-v2-api";
import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import { sortDailyPlans } from "@/lib/teaching-mode-slides";
import { QuizArtifactCard } from "@/components/teacher-assist-v2/teacher-assist-v2-quiz-artifact-card";
import { TeacherAssistV2AddAssignmentPanel } from "@/components/teacher-assist-v2/teacher-assist-v2-add-assignment-panel";
import { TeacherAssistV2RubricEditor } from "@/components/teacher-assist-v2/teacher-assist-v2-rubric-editor";
import type { InstructionalPackageArtifact, InstructionalPackageDetail } from "@/lib/teacher-assist-v2-types";

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  assignment: "Assignment",
  writing_response: "Writing Response",
  quiz: "Quiz",
  rubric: "Rubric",
  exit_ticket: "Exit Ticket",
};

const STUDENT_MATERIAL_TYPE_LABELS: Record<string, string> = {
  bell_ringer: "Bell Ringer",
  vocabulary_list: "Vocabulary List",
  study_guide: "Study Guide",
};

const PREVIEW_LABELS: Record<string, string> = {
  quiz: "Preview Quiz",
  exit_ticket: "Preview Exit Ticket",
  assignment: "Preview Assignment",
  writing_response: "Preview Writing Response",
  rubric: "Preview Rubric",
  parent_newsletter_summary: "Preview Newsletter",
  daily_lesson_plan: "Review",
  subject_slide_deck: "Review",
};

const SLIDE_DECK_PPTX_NOTE =
  "PowerPoint export is not available yet. Use Present for classroom display or Print / Save as PDF for offline use.";

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  processing: "border-violet-200 bg-violet-50 text-violet-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  generated: "border-sky-200 bg-sky-50 text-sky-800",
  ending_soon: "border-amber-200 bg-amber-50 text-amber-900",
  expired: "border-rose-200 bg-rose-50 text-rose-800",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function weekRangeLabel(weekStart: number, weekEnd: number): string {
  return weekStart === weekEnd ? `Week ${weekStart}` : `Weeks ${weekStart}–${weekEnd}`;
}

function formatArtifactStatus(status: string | undefined): string {
  return (status ?? "ready").replaceAll("_", " ");
}

function dailyPlanSubjects(artifact: InstructionalPackageArtifact): string[] {
  const subjects = artifact.content_json?.subjects;
  if (Array.isArray(subjects)) {
    return subjects
      .map((entry) => {
        if (entry && typeof entry === "object" && "subject_name" in entry) {
          return String((entry as { subject_name?: unknown }).subject_name ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function dailyPresentHref(packageId: string, dayLabel: string | null): string {
  return `/teacher-assist-v2/teach?packageId=${packageId}&mode=daily&day=${encodeURIComponent(dayLabel ?? "")}&start=1`;
}

function subjectPresentHref(packageId: string, artifactId: string): string {
  return `/teacher-assist-v2/teach?packageId=${packageId}&mode=subject&artifactId=${artifactId}&start=1`;
}

function studentDailyPresentHref(packageId: string, dayLabel: string | null): string {
  return `/teacher-assist-v2/teach?packageId=${packageId}&mode=student_daily&day=${encodeURIComponent(dayLabel ?? "")}&start=1`;
}

function studentSubjectPresentHref(packageId: string, artifactId: string): string {
  return `/teacher-assist-v2/teach?packageId=${packageId}&mode=student_subject&artifactId=${artifactId}&start=1`;
}

function ArtifactReviewPanel({
  artifact,
  expanded,
}: {
  artifact: InstructionalPackageArtifact;
  expanded: boolean;
}) {
  if (!expanded) return null;

  const visualAssets = artifact.slide_visual_assets ?? [];
  const alignmentLine =
    artifact.alignment_summary ?? artifact.objective_mapping?.alignment_summary ?? objectiveLine(artifact);

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      {alignmentLine ? (
        <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <span className="font-semibold">Aligned to:</span> {alignmentLine}
        </div>
      ) : null}
      {visualAssets.length > 0 ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Visual recommendations</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visualAssets.map((asset) => (
              <div key={asset.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <p className="font-medium text-slate-900">
                  {(asset.title || asset.visual_type || "Visual").replaceAll("_", " ")}
                </p>
                {asset.description ? <p className="mt-1">{asset.description}</p> : null}
                <p className="mt-2 text-slate-600">
                  Layout: {asset.layout_template?.replaceAll("_", " ") || "Recommended"} · Placement:{" "}
                  {asset.suggested_placement || "Auto"}
                </p>
                {(asset.search_terms ?? []).length > 0 ? (
                  <p className="mt-1 text-slate-600">Search terms: {asset.search_terms?.join(", ")}</p>
                ) : null}
                {(asset.suggested_sources ?? []).length > 0 ? (
                  <p className="mt-1 text-slate-600">Sources: {asset.suggested_sources?.join(", ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {artifact.preview_html ? (
        <iframe
          title={artifact.title}
          className="h-96 w-full rounded-lg border border-slate-200 bg-white"
          srcDoc={artifact.preview_html}
        />
      ) : (
        <p className="text-xs text-slate-500">Preview unavailable.</p>
      )}
    </div>
  );
}

function objectiveLine(artifact: InstructionalPackageArtifact): string | null {
  const mapping = artifact.objective_mapping;
  if (!mapping?.objective_text) return null;
  return mapping.objective_text.trim() || null;
}

function dailyPlanTopic(artifact: InstructionalPackageArtifact): string | null {
  const contentTopic =
    artifact.content_json && typeof artifact.content_json.daily_topic === "string"
      ? artifact.content_json.daily_topic.trim()
      : "";
  const mappingTopic = artifact.objective_mapping?.daily_topic?.trim() ?? "";
  const summary =
    artifact.content_json && typeof artifact.content_json.summary === "string"
      ? artifact.content_json.summary.trim()
      : "";
  return contentTopic || mappingTopic || summary || null;
}

function weeklyStandardLine(artifact: InstructionalPackageArtifact): string | null {
  const codes = artifact.teks_ids?.length ? artifact.teks_ids : artifact.objective_mapping?.teks_ids;
  if (codes && codes.length > 0) {
    return `Standards: ${codes.join(", ")}`;
  }
  const code = artifact.objective_mapping?.objective_code;
  return code ? `Standard: ${code}` : null;
}

function openPrintableHtml(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function ArtifactActions({
  artifact,
  expanded,
  onReview,
  presentHref,
  studentPresentHref,
  reviewLabel,
  footerNote,
  qrPacketHref,
}: {
  artifact: InstructionalPackageArtifact;
  expanded: boolean;
  onReview: () => void;
  presentHref?: string;
  studentPresentHref?: string;
  reviewLabel?: string;
  footerNote?: string;
  qrPacketHref?: string | null;
}) {
  const previewLabel = reviewLabel ?? PREVIEW_LABELS[artifact.artifact_type] ?? "Review";
  const printHref = artifact.download_url
    ? resolveTeacherAssistFileUrl(artifact.download_url) ?? artifact.download_url
    : null;
  const answerKeyPreviewHref =
    artifact.artifact_type === "quiz"
      ? (artifact.additional_downloads ?? []).find(
          (item) => item.format === "html" && item.label.toLowerCase().includes("answer key"),
        )
      : undefined;
  const answerKeyUrl = answerKeyPreviewHref
    ? resolveTeacherAssistFileUrl(answerKeyPreviewHref.download_url) ?? answerKeyPreviewHref.download_url
    : null;

  return (
    <div className="border-t border-slate-100 px-4 py-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs" onClick={onReview}>
          {expanded ? "Hide preview" : previewLabel}
        </button>
        {answerKeyUrl ? (
          <a
            href={answerKeyUrl}
            target="_blank"
            rel="noreferrer"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
          >
            Preview Answer Key
          </a>
        ) : null}
        {presentHref ? (
          <Link href={presentHref} className="ta-button-primary inline-flex h-8 items-center px-3 text-xs">
            Present (Teacher)
          </Link>
        ) : null}
        {studentPresentHref ? (
          <Link
            href={studentPresentHref}
            className="inline-flex h-8 items-center rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700"
          >
            Present to Students
          </Link>
        ) : null}
        {artifact.preview_html ? (
          <button
            type="button"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
            onClick={() => openPrintableHtml(artifact.preview_html ?? "")}
          >
            Print / Save as PDF
          </button>
        ) : printHref ? (
          <a
            href={printHref}
            target="_blank"
            rel="noreferrer"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
          >
            Print / Save as PDF
          </a>
        ) : (
          <span className="inline-flex h-8 items-center px-1 text-xs text-slate-500">
            Print export is not available for this artifact yet.
          </span>
        )}
        {qrPacketHref ? (
          <a
            href={qrPacketHref}
            target="_blank"
            rel="noreferrer"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
          >
            Generate / Download QR Student Packet
          </a>
        ) : null}
        {(artifact.additional_downloads ?? []).map((item) => (
          <a
            key={`${item.label}-${item.download_url}`}
            href={resolveTeacherAssistFileUrl(item.download_url) ?? item.download_url}
            target="_blank"
            rel="noreferrer"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
          >
            {item.label}
          </a>
        ))}
      </div>
      {footerNote ? <p className="mt-2 text-xs text-slate-600">{footerNote}</p> : null}
    </div>
  );
}

function DailyTeachingPlanItem({
  artifact,
  packageId,
  studentLessonDecks,
  expandedArtifactId,
  setExpandedArtifactId,
}: {
  artifact: InstructionalPackageArtifact;
  packageId: string;
  studentLessonDecks: InstructionalPackageArtifact[];
  expandedArtifactId: string | null;
  setExpandedArtifactId: (id: string | null) => void;
}) {
  const expanded = expandedArtifactId === artifact.id;
  const subjects = dailyPlanSubjects(artifact);
  const studentDeck = studentLessonDecks.find((d) => d.day_label === artifact.day_label && Boolean(d.day_label));

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{artifact.day_label ?? "Day"}</p>
            <p className="mt-1 font-medium text-slate-900">{artifact.title}</p>
            {dailyPlanTopic(artifact) ? (
              <p className="mt-1 text-sm text-slate-800">Today&apos;s focus: {dailyPlanTopic(artifact)}</p>
            ) : null}
            <p className="mt-1 text-xs text-slate-600">
              Subjects included: {subjects.length > 0 ? subjects.join(" · ") : "See plan for subjects"}
            </p>
            {artifact.description ? <p className="mt-1 text-xs text-slate-600">{artifact.description}</p> : null}
            {objectiveLine(artifact) ? (
              <p className="mt-1 text-xs text-slate-600">Objective: {objectiveLine(artifact)}</p>
            ) : null}
            {artifact.alignment_summary ? (
              <p className="mt-1 text-xs text-slate-600">Aligned to: {artifact.alignment_summary}</p>
            ) : null}
            {weeklyStandardLine(artifact) ? (
              <p className="mt-1 text-xs text-slate-500">{weeklyStandardLine(artifact)}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
              STATUS_STYLES[artifact.status ?? "ready"] ?? "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {formatArtifactStatus(artifact.status)}
          </span>
        </div>
      </div>
      <ArtifactActions
        artifact={artifact}
        expanded={expanded}
        presentHref={dailyPresentHref(packageId, artifact.day_label)}
        studentPresentHref={artifact.day_label ? studentDailyPresentHref(packageId, artifact.day_label) : undefined}
        onReview={() => setExpandedArtifactId(expanded ? null : artifact.id)}
      />
      {studentDeck ? null : (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          Student lesson deck not yet generated for this day.
        </p>
      )}
      <ArtifactReviewPanel artifact={artifact} expanded={expanded} />
    </li>
  );
}

function SubjectSlideDeckItem({
  artifact,
  packageId,
  weekStart,
  weekEnd,
  studentLessonDecks,
  expandedArtifactId,
  setExpandedArtifactId,
}: {
  artifact: InstructionalPackageArtifact;
  packageId: string;
  weekStart: number;
  weekEnd: number;
  studentLessonDecks: InstructionalPackageArtifact[];
  expandedArtifactId: string | null;
  setExpandedArtifactId: (id: string | null) => void;
}) {
  const expanded = expandedArtifactId === artifact.id;
  const studentDeck = studentLessonDecks.find((d) => d.subject_id === artifact.subject_id && !d.day_label);

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {artifact.subject_name ?? "Subject"}
            </p>
            <p className="mt-1 font-medium text-slate-900">{artifact.title}</p>
            <p className="mt-1 text-xs text-slate-600">{weekRangeLabel(weekStart, weekEnd)}</p>
            {artifact.description ? <p className="mt-1 text-xs text-slate-600">{artifact.description}</p> : null}
            {objectiveLine(artifact) ? (
              <p className="mt-1 text-xs text-slate-500">Objective: {objectiveLine(artifact)}</p>
            ) : null}
            {artifact.alignment_summary ? (
              <p className="mt-1 text-xs text-slate-500">Aligned to: {artifact.alignment_summary}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
              STATUS_STYLES[artifact.status ?? "ready"] ?? "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {formatArtifactStatus(artifact.status)}
          </span>
        </div>
      </div>
      <ArtifactActions
        artifact={artifact}
        expanded={expanded}
        presentHref={subjectPresentHref(packageId, artifact.id)}
        studentPresentHref={studentDeck ? studentSubjectPresentHref(packageId, studentDeck.id) : undefined}
        footerNote={SLIDE_DECK_PPTX_NOTE}
        onReview={() => setExpandedArtifactId(expanded ? null : artifact.id)}
      />
      {!studentDeck ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          Student lesson deck not yet generated for this subject.
        </p>
      ) : null}
      <ArtifactReviewPanel artifact={artifact} expanded={expanded} />
    </li>
  );
}

function GenericArtifactItem({
  artifact,
  typeLabel,
  expandedArtifactId,
  setExpandedArtifactId,
  qrPacketHref,
}: {
  artifact: InstructionalPackageArtifact;
  typeLabel: string;
  expandedArtifactId: string | null;
  setExpandedArtifactId: (id: string | null) => void;
  qrPacketHref?: string | null;
}) {
  const expanded = expandedArtifactId === artifact.id;

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{typeLabel}</p>
            <p className="mt-1 font-medium text-slate-900">{artifact.title}</p>
            {artifact.package_additional ? (
              <p className="mt-1 text-xs font-medium text-sky-700">Additional assignment</p>
            ) : null}
            {artifact.description ? <p className="mt-1 text-xs text-slate-600">{artifact.description}</p> : null}
            {objectiveLine(artifact) ? (
              <p className="mt-1 text-xs text-slate-500">Objective: {objectiveLine(artifact)}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
              STATUS_STYLES[artifact.status ?? "ready"] ?? "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {formatArtifactStatus(artifact.status)}
          </span>
        </div>
      </div>
      <ArtifactActions
        artifact={artifact}
        expanded={expanded}
        qrPacketHref={qrPacketHref}
        onReview={() => setExpandedArtifactId(expanded ? null : artifact.id)}
      />
      <ArtifactReviewPanel artifact={artifact} expanded={expanded} />
    </li>
  );
}

function resolveLinkedRubricId(artifact: InstructionalPackageArtifact): string | null {
  if (artifact.linked_rubric_artifact_id) {
    return artifact.linked_rubric_artifact_id;
  }
  const contentLinked = artifact.content_json?.linked_rubric_artifact_id;
  return typeof contentLinked === "string" && contentLinked.trim() ? contentLinked : null;
}

function buildArtifactLookup(artifacts: InstructionalPackageArtifact[]): Map<string, InstructionalPackageArtifact> {
  return new Map(artifacts.map((artifact) => [artifact.id, artifact]));
}

function rubricTotalPoints(artifact: InstructionalPackageArtifact): number | null {
  if (!Array.isArray(artifact.content_json?.criteria)) {
    return null;
  }
  return (artifact.content_json.criteria as Array<{ points?: number }>).reduce(
    (sum, row) => sum + Number(row.points ?? 0),
    0,
  );
}

function LinkedRubricPanel({
  rubric,
  packageId,
  expandedArtifactId,
  setExpandedArtifactId,
  onRefresh,
}: {
  rubric: InstructionalPackageArtifact;
  packageId: string;
  expandedArtifactId: string | null;
  setExpandedArtifactId: (id: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const expanded = expandedArtifactId === rubric.id;
  const [editing, setEditing] = useState(false);
  const totalPoints = rubricTotalPoints(rubric);

  return (
    <div className="border-t border-slate-200 bg-slate-50/80">
      <div className="px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grading Rubric</p>
            <p className="mt-1 font-medium text-slate-900">{rubric.title}</p>
            {rubric.description ? <p className="mt-1 text-xs text-slate-600">{rubric.description}</p> : null}
            {totalPoints !== null ? <p className="mt-1 text-xs text-slate-500">Total points: {totalPoints}</p> : null}
            {rubric.teacher_edited ? <p className="mt-1 text-xs text-emerald-700">Teacher updated</p> : null}
          </div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
              STATUS_STYLES[rubric.status ?? "ready"] ?? "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {formatArtifactStatus(rubric.status)}
          </span>
        </div>
      </div>
      <div className="border-t border-slate-200/80 px-4 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
            onClick={() => {
              setEditing(false);
              setExpandedArtifactId(expanded ? null : rubric.id);
            }}
          >
            {expanded ? "Hide rubric preview" : "Preview rubric"}
          </button>
          <button
            type="button"
            className="ta-button-primary inline-flex h-8 items-center px-3 text-xs"
            onClick={() => {
              setExpandedArtifactId(null);
              setEditing((current) => !current);
            }}
          >
            {editing ? "Close editor" : "Edit rubric"}
          </button>
          {rubric.preview_html ? (
            <button
              type="button"
              className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
              onClick={() => openPrintableHtml(rubric.preview_html ?? "")}
            >
              Print rubric
            </button>
          ) : null}
        </div>
      </div>
      <ArtifactReviewPanel artifact={rubric} expanded={expanded} />
      {editing ? (
        <TeacherAssistV2RubricEditor
          packageId={packageId}
          artifact={rubric}
          onSaved={async () => {
            setEditing(false);
            await onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AssessedArtifactWithRubricItem({
  artifact,
  typeLabel,
  rubric,
  packageId,
  expandedArtifactId,
  setExpandedArtifactId,
  onRefresh,
  qrPacketHref,
}: {
  artifact: InstructionalPackageArtifact;
  typeLabel: string;
  rubric: InstructionalPackageArtifact | null;
  packageId: string;
  expandedArtifactId: string | null;
  setExpandedArtifactId: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  qrPacketHref?: string | null;
}) {
  const expanded = expandedArtifactId === artifact.id;

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{typeLabel}</p>
            <p className="mt-1 font-medium text-slate-900">{artifact.title}</p>
            {artifact.package_additional ? (
              <p className="mt-1 text-xs font-medium text-sky-700">Additional assignment</p>
            ) : null}
            {artifact.description ? <p className="mt-1 text-xs text-slate-600">{artifact.description}</p> : null}
            {objectiveLine(artifact) ? (
              <p className="mt-1 text-xs text-slate-500">Objective: {objectiveLine(artifact)}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
              STATUS_STYLES[artifact.status ?? "ready"] ?? "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {formatArtifactStatus(artifact.status)}
          </span>
        </div>
      </div>
      <ArtifactActions
        artifact={artifact}
        expanded={expanded}
        qrPacketHref={qrPacketHref}
        onReview={() => setExpandedArtifactId(expanded ? null : artifact.id)}
      />
      <ArtifactReviewPanel artifact={artifact} expanded={expanded} />
      {rubric ? (
        <LinkedRubricPanel
          rubric={rubric}
          packageId={packageId}
          expandedArtifactId={expandedArtifactId}
          setExpandedArtifactId={setExpandedArtifactId}
          onRefresh={onRefresh}
        />
      ) : (
        <p className="border-t border-slate-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          No linked rubric found for this item yet.
        </p>
      )}
    </li>
  );
}

function RubricArtifactItem({
  artifact,
  packageId,
  expandedArtifactId,
  setExpandedArtifactId,
  onRefresh,
}: {
  artifact: InstructionalPackageArtifact;
  packageId: string;
  expandedArtifactId: string | null;
  setExpandedArtifactId: (id: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <LinkedRubricPanel
        rubric={artifact}
        packageId={packageId}
        expandedArtifactId={expandedArtifactId}
        setExpandedArtifactId={setExpandedArtifactId}
        onRefresh={onRefresh}
      />
    </li>
  );
}

function QrStudentPacketItem({
  packet,
  expanded,
  onReview,
}: {
  packet: NonNullable<InstructionalPackageDetail["qr_student_packet"]>;
  expanded: boolean;
  onReview: () => void;
}) {
  const downloadHref = packet.download_url ? resolveTeacherAssistFileUrl(packet.download_url) ?? packet.download_url : null;
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR Student Packet</p>
        <p className="mt-1 font-medium text-slate-900">{packet.title}</p>
        <p className="mt-1 text-xs text-slate-600">{packet.student_count} student packets with QR codes</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2">
        <button type="button" className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs" onClick={onReview}>
          {expanded ? "Hide preview" : "Preview Packet"}
        </button>
        {packet.preview_html ? (
          <button
            type="button"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
            onClick={() => openPrintableHtml(packet.preview_html ?? "")}
          >
            Print / Save as PDF
          </button>
        ) : downloadHref ? (
          <a href={downloadHref} target="_blank" rel="noreferrer" className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs">
            Print / Save as PDF
          </a>
        ) : (
          <span className="inline-flex h-8 items-center px-1 text-xs text-slate-500">
            Print export is not available for this packet yet.
          </span>
        )}
      </div>
      {expanded && packet.preview_html ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <iframe title={packet.title} className="h-96 w-full rounded-lg border border-slate-200 bg-white" srcDoc={packet.preview_html} />
        </div>
      ) : null}
    </li>
  );
}

function SupportingMaterialsSection({ detail }: { detail: InstructionalPackageDetail }) {
  const hasDistrict = detail.district_materials.length > 0;
  const hasSupplemental = detail.teacher_supplemental_materials.length > 0;

  if (!hasDistrict && !hasSupplemental) {
    return (
      <p className="text-sm text-slate-600">No district or teacher supplemental materials are linked to this package.</p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {hasDistrict ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">District resources</h3>
          <ul className="mt-2 space-y-2">
            {detail.district_materials.map((item, i) => (
              <li key={`${item.id}-${i}`} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.material_kind} · {item.resource_type.replaceAll("_", " ")}
                </p>
                {item.extraction?.status ? (
                  <p className="mt-1 text-xs text-slate-600">
                    {item.extraction.has_usable_text ? "File text extracted" : `Status: ${item.extraction.status.replaceAll("_", " ")}`}
                  </p>
                ) : null}
                {item.extraction?.preview ? (
                  <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">{item.extraction.preview}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasSupplemental ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher supplemental materials</h3>
          <ul className="mt-2 space-y-2">
            {detail.teacher_supplemental_materials.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.material_kind} · {item.resource_type.replaceAll("_", " ")}
                </p>
                {item.extraction?.status ? (
                  <p className="mt-1 text-xs text-slate-600">
                    {item.extraction.has_usable_text ? "File text extracted" : `Status: ${item.extraction.status.replaceAll("_", " ")}`}
                  </p>
                ) : null}
                {item.extraction?.preview ? (
                  <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">{item.extraction.preview}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function TeacherAssistV2PackageViewerScreen({ packageId: packageIdProp }: { packageId?: string } = {}) {
  const searchParams = useSearchParams();
  const { setProcessingIndicator, clearProcessingIndicator } = useTeacherAssistV2();
  const packageId = packageIdProp ?? searchParams.get("id") ?? "";
  const showPendingConfirmation = searchParams.get("pending") === "1";
  const [detail, setDetail] = useState<InstructionalPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const [showCloseOut, setShowCloseOut] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [confirmTeachingDone, setConfirmTeachingDone] = useState(false);

  const refresh = useCallback(async () => {
    if (!detail) {
      setLoading(true);
    }
    setError(null);
    try {
      const next = await fetchV2InstructionalPackage(packageId);
      setDetail(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Package not found.");
    } finally {
      if (!detail) {
        setLoading(false);
      }
    }
  }, [detail, packageId]);

  useEffect(() => {
    if (!packageId) return;
    void refresh();
  }, [packageId, refresh]);

  useEffect(() => {
    if (detail?.status !== "processing") return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [detail?.status, refresh]);

  useEffect(() => {
    if (!detail) return;
    if (detail.status === "processing") {
      setProcessingIndicator({
        kind: "package",
        targetId: detail.id,
        label: "Instructional package processing",
      });
      return;
    }
    clearProcessingIndicator(detail.id);
  }, [clearProcessingIndicator, detail, setProcessingIndicator]);

  const dailyTeachingPlans = useMemo(
    () => sortDailyPlans(detail?.artifact_groups.daily_teaching_plans ?? []),
    [detail],
  );
  const subjectSlideDecks = detail?.artifact_groups.subject_slide_decks ?? [];
  const studentLessonDecks = detail?.artifact_groups.student_lesson_decks ?? [];
  const assessmentArtifacts = useMemo(
    () => detail?.artifact_groups.assessments ?? [],
    [detail],
  );
  const quizArtifacts = assessmentArtifacts.filter((item) => item.artifact_type === "quiz");
  const writingResponseArtifacts = assessmentArtifacts.filter((item) => item.artifact_type === "writing_response");
  const exitTicketArtifacts = assessmentArtifacts.filter((item) => item.artifact_type === "exit_ticket");
  const rubricArtifacts = assessmentArtifacts.filter((item) => item.artifact_type === "rubric");
  const assignmentArtifacts = assessmentArtifacts.filter((item) => item.artifact_type === "assignment");
  const artifactLookup = useMemo(() => buildArtifactLookup(assessmentArtifacts), [assessmentArtifacts]);
  const linkedRubricIds = useMemo(() => {
    const linked = new Set<string>();
    for (const artifact of [...writingResponseArtifacts, ...assignmentArtifacts]) {
      const rubricId = resolveLinkedRubricId(artifact);
      if (rubricId) {
        linked.add(rubricId);
      }
    }
    return linked;
  }, [writingResponseArtifacts, assignmentArtifacts]);
  const orphanRubricArtifacts = useMemo(
    () => rubricArtifacts.filter((artifact) => !linkedRubricIds.has(artifact.id)),
    [rubricArtifacts, linkedRubricIds],
  );
  const resolveLinkedRubric = (artifact: InstructionalPackageArtifact) => {
    const rubricId = resolveLinkedRubricId(artifact);
    return rubricId ? (artifactLookup.get(rubricId) ?? null) : null;
  };
  const communicationArtifacts = detail?.artifact_groups.communication ?? [];
  const studentMaterialArtifacts = detail?.artifact_groups.student_materials ?? [];
  const qrStudentPacket = detail?.qr_student_packet ?? null;
  const qrPacketHref = qrStudentPacket?.download_url
    ? resolveTeacherAssistFileUrl(qrStudentPacket.download_url) ?? qrStudentPacket.download_url
    : null;

  const submitCloseOut = async () => {
    setError(null);
    setMessage(null);
    if (!confirmReviewed || !confirmTeachingDone) {
      setError("Confirm the checklist items before closing out.");
      return;
    }
    try {
      const updated = await closeOutV2InstructionalPackage(packageId, {
        close_out_notes: closeNotes.trim() || null,
      });
      setDetail(updated);
      setShowCloseOut(false);
      setMessage("Plan marked done.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not close out plan.");
    }
  };

  if (!packageId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        No package selected.{" "}
        <Link href="/teacher-assist-v2/packages" className="font-semibold text-sky-700">
          View all packages
        </Link>
        .
      </div>
    );
  }

  if (loading) {
    if (showPendingConfirmation) {
      return (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-900">
          <p className="font-semibold text-slate-900">Your instructional package is being processed.</p>
          <p className="mt-1">It will be available soon. You can keep using TeacherAssist while it finishes.</p>
        </div>
      );
    }
    return <p className="text-sm text-slate-600">Loading instructional package...</p>;
  }
  if (!detail) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {error ?? "Package not found."}
      </div>
    );
  }

  const weekLabel = weekRangeLabel(detail.week_start, detail.week_end);
  const packageProcessing = detail.status === "processing";

  return (
    <div className="max-w-4xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <Link href="/teacher-assist-v2/packages" className="text-xs font-semibold text-sky-700">
          ← All packages
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{detail.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {weekLabel} · {detail.plan_start_date} – {detail.plan_end_date}
        </p>
        <p
          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[detail.status] ?? "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {detail.status.replaceAll("_", " ")}
        </p>
        {detail.closed_at ? (
          <p className="mt-2 text-xs text-slate-600">Closed out on {detail.closed_at}</p>
        ) : null}
      </header>

      {detail.status_message ? (
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            packageProcessing
              ? "border border-violet-200 bg-violet-50 text-violet-900"
              : detail.status === "failed"
                ? "border border-rose-200 bg-rose-50 text-rose-800"
                : "border border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {detail.status_message}
        </div>
      ) : null}
      {detail.ai_readiness_summary ? (
        <div
          className={`rounded-xl border px-3 py-3 text-sm ${
            detail.ai_readiness_summary.continue_with_filenames_only
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <p className="font-semibold text-slate-900">Package generation result</p>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <p>Provider: {detail.provider_name ?? "Unknown"}</p>
            <p>Extracted text available: {detail.ai_readiness_summary.extracted_text_available_count}</p>
            <p>Files pending extraction: {detail.ai_readiness_summary.files_pending_count}</p>
            <p>Files failed extraction: {detail.ai_readiness_summary.files_failed_count}</p>
          </div>
          {detail.ai_readiness_summary.continue_with_filenames_only ? (
            <p className="mt-2 text-xs">Some uploaded files were skipped or only used by filename and description.</p>
          ) : (
            <p className="mt-2 text-xs">Extracted document content was available for package generation.</p>
          )}
        </div>
      ) : null}
      {detail.generation_document_usage ? (
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Files used by AI</p>
          <div className="mt-3 space-y-3 text-xs">
            {(["district", "teacher"] as const).map((group) => {
              const usage = detail.generation_document_usage?.[group];
              if (!usage) return null;
              return (
                <div key={group}>
                  <p className="font-semibold capitalize text-slate-800">{group} documents</p>
                  {usage.used_documents.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {usage.used_documents.map((doc, i) => (
                        <li key={`${group}-used-${doc.title}-${i}`} className="rounded-md bg-emerald-50 px-2 py-1">
                          {doc.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-500">No extracted document text used.</p>
                  )}
                  {usage.skipped_documents.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {usage.skipped_documents.map((doc, i) => (
                        <li key={`${group}-skipped-${doc.title}-${i}`} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">
                          {doc.title}: {doc.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Instruction</h2>

        <div className="mt-4 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Daily Teaching Plans</h3>
            <p className="mt-1 text-xs text-slate-600">
              One plan per day covering all subjects in your teaching order. Use for full-day classroom teaching.
            </p>
            {dailyTeachingPlans.length === 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No daily teaching plans were generated for this package.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dailyTeachingPlans.map((artifact) => (
                  <DailyTeachingPlanItem
                    key={artifact.id}
                    artifact={artifact}
                    packageId={detail.id}
                    studentLessonDecks={studentLessonDecks}
                    expandedArtifactId={expandedArtifactId}
                    setExpandedArtifactId={setExpandedArtifactId}
                  />
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Subject Slide Decks</h3>
            <p className="mt-1 text-xs text-slate-600">
              One slide deck per subject for the selected week. Use for teaching one subject block.
            </p>
            {subjectSlideDecks.length === 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No subject slide decks were generated for this package.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {subjectSlideDecks.map((artifact) => (
                  <SubjectSlideDeckItem
                    key={artifact.id}
                    artifact={artifact}
                    packageId={detail.id}
                    weekStart={detail.week_start}
                    weekEnd={detail.week_end}
                    studentLessonDecks={studentLessonDecks}
                    expandedArtifactId={expandedArtifactId}
                    setExpandedArtifactId={setExpandedArtifactId}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {(quizArtifacts.length > 0 ||
        writingResponseArtifacts.length > 0 ||
        exitTicketArtifacts.length > 0 ||
        detail.can_close_out) ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Assessments</h2>
          <p className="mt-1 text-xs text-slate-600">
            Writing responses include their grading rubric in the same card — preview, edit, and print both together.
          </p>
          {detail.can_close_out && (
            packageProcessing ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-900">
                Additional assignments unlock after this package finishes generating.
              </div>
            ) : (
              <TeacherAssistV2AddAssignmentPanel packageId={detail.id} onGenerated={refresh} />
            )
          )}
          <ul className="mt-3 space-y-2">
            {quizArtifacts.map((artifact) => (
              <QuizArtifactCard
                key={artifact.id}
                artifact={artifact}
                expanded={expandedArtifactId === artifact.id}
                onTogglePreview={() =>
                  setExpandedArtifactId(expandedArtifactId === artifact.id ? null : artifact.id)
                }
              />
            ))}
            {writingResponseArtifacts.map((artifact) => (
              <AssessedArtifactWithRubricItem
                key={artifact.id}
                artifact={artifact}
                typeLabel="Writing Response"
                rubric={resolveLinkedRubric(artifact)}
                packageId={detail.id}
                expandedArtifactId={expandedArtifactId}
                setExpandedArtifactId={setExpandedArtifactId}
                onRefresh={refresh}
              />
            ))}
            {exitTicketArtifacts.map((artifact) => (
              <GenericArtifactItem
                key={artifact.id}
                artifact={artifact}
                typeLabel="Exit Ticket"
                expandedArtifactId={expandedArtifactId}
                setExpandedArtifactId={setExpandedArtifactId}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {(assignmentArtifacts.length > 0 || studentMaterialArtifacts.length > 0 || qrStudentPacket) ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Student Materials</h2>
          <p className="mt-1 text-xs text-slate-600">
            Written assignments include their grading rubric below the assignment prompt.
          </p>
          <ul className="mt-3 space-y-2">
            {assignmentArtifacts.map((artifact) => (
              <AssessedArtifactWithRubricItem
                key={artifact.id}
                artifact={artifact}
                typeLabel="Written Assignment"
                rubric={resolveLinkedRubric(artifact)}
                packageId={detail.id}
                qrPacketHref={qrPacketHref}
                expandedArtifactId={expandedArtifactId}
                setExpandedArtifactId={setExpandedArtifactId}
                onRefresh={refresh}
              />
            ))}
            {qrStudentPacket ? (
              <QrStudentPacketItem
                packet={qrStudentPacket}
                expanded={expandedArtifactId === `qr-${qrStudentPacket.packet_id}`}
                onReview={() =>
                  setExpandedArtifactId(
                    expandedArtifactId === `qr-${qrStudentPacket.packet_id}` ? null : `qr-${qrStudentPacket.packet_id}`,
                  )
                }
              />
            ) : null}
            {studentMaterialArtifacts.map((artifact) => (
              <GenericArtifactItem
                key={artifact.id}
                artifact={artifact}
                typeLabel={
                  STUDENT_MATERIAL_TYPE_LABELS[artifact.artifact_type] ?? artifact.artifact_type.replaceAll("_", " ")
                }
                expandedArtifactId={expandedArtifactId}
                setExpandedArtifactId={setExpandedArtifactId}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {orphanRubricArtifacts.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Unlinked Rubrics</h2>
          <p className="mt-1 text-xs text-slate-600">
            These rubrics are not linked to a writing response or written assignment in this package.
          </p>
          <ul className="mt-3 space-y-2">
            {orphanRubricArtifacts.map((artifact) => (
              <RubricArtifactItem
                key={artifact.id}
                artifact={artifact}
                packageId={detail.id}
                expandedArtifactId={expandedArtifactId}
                setExpandedArtifactId={setExpandedArtifactId}
                onRefresh={refresh}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {communicationArtifacts.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Communication</h2>
          <ul className="mt-3 space-y-2">
            {communicationArtifacts.map((artifact) => (
              <GenericArtifactItem
                key={artifact.id}
                artifact={artifact}
                typeLabel="Parent Newsletter Summary"
                expandedArtifactId={expandedArtifactId}
                setExpandedArtifactId={setExpandedArtifactId}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Supporting Materials</h2>
        <div className="mt-3">
          <SupportingMaterialsSection detail={detail} />
        </div>
      </section>

      {detail.can_close_out ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Close out plan</h2>
          {!showCloseOut ? (
            <button type="button" className="ta-button-primary mt-3 h-9 px-4 text-sm" onClick={() => setShowCloseOut(true)}>
              Mark Done
            </button>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-slate-700">Before closing, confirm:</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={confirmReviewed} onChange={(e) => setConfirmReviewed(e.target.checked)} />
                Generated materials reviewed
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={confirmTeachingDone} onChange={(e) => setConfirmTeachingDone(e.target.checked)} />
                Teaching completed
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Close-out notes (optional)</span>
                <textarea className="ta-input min-h-[88px]" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <button type="button" className="ta-button-primary h-9 px-4 text-sm" onClick={() => void submitCloseOut()}>
                  Close Out Plan
                </button>
                <button type="button" className="ta-button-secondary h-9 px-4 text-sm" onClick={() => setShowCloseOut(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      ) : detail.close_out_notes ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm">
          <h2 className="font-semibold text-slate-900">Close-out notes</h2>
          <p className="mt-2 text-slate-700">{detail.close_out_notes}</p>
        </section>
      ) : null}
    </div>
  );
}
