"use client";

import { useState } from "react";

import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import type { InstructionalPackageArtifact } from "@/lib/teacher-assist-v2-types";

const GOOGLE_FORMS_JSON_HELPER =
  "Google Forms API integration is not enabled yet. Download the JSON, create a Google Form manually with the student-number dropdown first, add the quiz questions, enable quiz mode, then assign the form in Google Classroom.";

function openPrintableHtml(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function downloadHref(artifact: InstructionalPackageArtifact, matcher: (label: string, format: string) => boolean) {
  const item = (artifact.additional_downloads ?? []).find((download) =>
    matcher(download.label.toLowerCase(), download.format),
  );
  if (!item) return null;
  return resolveTeacherAssistFileUrl(item.download_url) ?? item.download_url;
}

function ArtifactReviewPanel({
  artifact,
  expanded,
}: {
  artifact: InstructionalPackageArtifact;
  expanded: boolean;
}) {
  if (!expanded) return null;
  return (
    <div className="border-t border-slate-100 px-4 py-3">
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

export function QuizArtifactCard({
  artifact,
  expanded,
  onTogglePreview,
}: {
  artifact: InstructionalPackageArtifact;
  expanded: boolean;
  onTogglePreview: () => void;
}) {
  const [showAnswerKeyPreview, setShowAnswerKeyPreview] = useState(false);

  const quizDocxHref = downloadHref(
    artifact,
    (label, format) => format === "docx" && label.includes("student quiz"),
  );
  const answerKeyDocxHref = downloadHref(artifact, (label, format) => format === "docx" && label.includes("answer key"));
  const googleJsonHref = downloadHref(artifact, (label, format) => format === "json" && label.includes("google forms"));
  const answerKeyPreviewHref = downloadHref(artifact, (label, format) => format === "html" && label.includes("preview answer key"));

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quiz</p>
        <p className="mt-1 font-medium text-slate-900">{artifact.title}</p>
        {artifact.description ? <p className="mt-1 text-xs text-slate-600">{artifact.description}</p> : null}
        <p className="mt-2 text-xs text-slate-600">
          Download one printable DOCX packet for your whole class. Each student gets every page with their own QR code and
          student number in the top-left corner.
        </p>
      </div>

      <div className="border-t border-slate-100 px-4 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
            onClick={onTogglePreview}
          >
            {expanded ? "Hide preview" : "Preview Quiz"}
          </button>

          {quizDocxHref ? (
            <a href={quizDocxHref} target="_blank" rel="noreferrer" className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs">
              Download Student Quiz DOCX
            </a>
          ) : null}

          {answerKeyDocxHref ? (
            <a
              href={answerKeyDocxHref}
              target="_blank"
              rel="noreferrer"
              className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
            >
              Download Answer Key DOCX
            </a>
          ) : null}

          {googleJsonHref ? (
            <a href={googleJsonHref} target="_blank" rel="noreferrer" className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs">
              Download Google Forms JSON
            </a>
          ) : null}

          {artifact.preview_html ? (
            <button
              type="button"
              className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
              onClick={() => openPrintableHtml(artifact.preview_html ?? "")}
            >
              Print / Save as PDF
            </button>
          ) : null}

          {answerKeyPreviewHref ? (
            <button
              type="button"
              className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
              onClick={() => setShowAnswerKeyPreview((current) => !current)}
            >
              {showAnswerKeyPreview ? "Hide Answer Key Preview" : "Preview Answer Key"}
            </button>
          ) : null}
        </div>

        {googleJsonHref ? <p className="mt-2 text-xs text-slate-600">{GOOGLE_FORMS_JSON_HELPER}</p> : null}
      </div>

      <ArtifactReviewPanel artifact={artifact} expanded={expanded} />
      {showAnswerKeyPreview && answerKeyPreviewHref ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <iframe
            title={`${artifact.title} Answer Key`}
            className="h-96 w-full rounded-lg border border-slate-200 bg-white"
            src={answerKeyPreviewHref}
          />
        </div>
      ) : null}
    </li>
  );
}
