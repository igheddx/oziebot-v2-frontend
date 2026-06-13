"use client";

import { useEffect, useState } from "react";

import { TeacherAssistV2AiModeBanner } from "@/components/teacher-assist-v2/teacher-assist-v2-ai-mode-banner";
import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import {
  fetchV2PackageAdditionalAssignmentForm,
  generateV2PackageAdditionalAssignment,
} from "@/lib/teacher-assist-v2-api";
import type { PackageAdditionalAssignmentForm } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2AddAssignmentPanel({
  packageId,
  onGenerated,
}: {
  packageId: string;
  onGenerated: () => Promise<void>;
}) {
  const { context } = useTeacherAssistV2();
  const [form, setForm] = useState<PackageAdditionalAssignmentForm | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [artifactType, setArtifactType] = useState("quiz");
  const [teacherNotes, setTeacherNotes] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2PackageAdditionalAssignmentForm(packageId)
      .then((payload) => {
        setForm(payload);
        if (payload.subjects[0]) {
          setSubjectId(payload.subjects[0].subject_id);
        }
        if (payload.assignment_types[0]) {
          setArtifactType(payload.assignment_types[0].id);
        }
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [packageId]);

  const submit = async () => {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await generateV2PackageAdditionalAssignment(packageId, {
        subject_id: subjectId,
        artifact_type: artifactType,
        teacher_notes: teacherNotes.trim(),
        title_hint: titleHint.trim() || undefined,
      });
      setMessage("Additional assignment generated.");
      setTeacherNotes("");
      setTitleHint("");
      const refreshed = await fetchV2PackageAdditionalAssignmentForm(packageId);
      setForm(refreshed);
      await onGenerated();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not generate assignment.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-600">Loading assignment options...</p>;
  if (!form) {
    return <p className="text-sm text-rose-700">{error ?? "Could not load assignment form."}</p>;
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <TeacherAssistV2AiModeBanner status={context?.ai_generation} />
      <h3 className="text-sm font-semibold text-slate-900">Add another assignment</h3>
      <p className="mt-1 text-xs text-slate-600">
        Create a new assignment for this plan without removing anything already generated. Your notes guide AI to make
        it different from existing assignments.
      </p>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {message ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Subject</span>
          <select className="ta-input h-9" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {form.subjects.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_id}>
                {subject.subject_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Assignment type</span>
          <select
            className="ta-input h-9"
            value={artifactType}
            onChange={(event) => setArtifactType(event.target.value)}
          >
            {form.assignment_types.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Guidance notes</span>
        <textarea
          className="ta-input min-h-[96px]"
          placeholder="Example: Create a second quiz focused on vocabulary from Tuesday's lesson, not the main idea quiz from Monday."
          value={teacherNotes}
          onChange={(event) => setTeacherNotes(event.target.value)}
        />
      </label>

      <label className="mt-3 block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Optional title hint</span>
        <input
          className="ta-input h-9"
          placeholder="Week 1 — ELA Vocabulary Quiz"
          value={titleHint}
          onChange={(event) => setTitleHint(event.target.value)}
        />
      </label>

      {form.existing_assignments.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Already in this plan</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {form.existing_assignments.map((item) => (
              <li key={item.artifact_id}>
                {item.title}
                {item.is_additional ? " · additional" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className="ta-button-primary mt-4 h-9 px-4 text-sm"
        disabled={generating || !teacherNotes.trim()}
        onClick={() => void submit()}
      >
        {generating ? "Generating..." : "Generate additional assignment"}
      </button>
    </div>
  );
}
