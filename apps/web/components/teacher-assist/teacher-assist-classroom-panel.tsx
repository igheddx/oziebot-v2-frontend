"use client";

import { useCallback, useEffect, useState } from "react";

import {
  TeacherAssistInlineAlert,
  sectionError,
  sectionSuccess,
  useTeacherAssistSectionAlerts,
} from "@/components/teacher-assist/teacher-assist-inline-alert";
import { fetchMyClassroom, saveMyClassroom } from "@/lib/teacher-assist-api";
import type { TeacherMyClassroom } from "@/lib/teacher-assist-types";
import { withPreservedScroll } from "@/lib/teacher-assist-scroll";

type Props = {
  onSaved?: () => void | Promise<void>;
  syncKey?: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatSchoolYearLabel(classroom: TeacherMyClassroom | null) {
  if (!classroom?.has_active_school_year) {
    return "No active school year";
  }
  const title = classroom.active_school_year_title ?? "Active school year";
  const start = formatDate(classroom.active_school_year_start_date);
  const end = formatDate(classroom.active_school_year_end_date);
  if (start && end) {
    return `${title} · ${start} – ${end}`;
  }
  return title;
}

export function TeacherAssistClassroomPanel({ onSaved, syncKey = 0 }: Props) {
  const { setSectionAlert, clearSectionAlert, getSectionAlert } = useTeacherAssistSectionAlerts();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classroom, setClassroom] = useState<TeacherMyClassroom | null>(null);
  const [homeroomName, setHomeroomName] = useState("");
  const [studentCount, setStudentCount] = useState("");
  const [timezone, setTimezone] = useState("");

  const loadClassroom = useCallback(async () => {
    setLoading(true);
    clearSectionAlert("classroom");
    try {
      const data = await fetchMyClassroom();
      setClassroom(data);
      setHomeroomName(data.homeroom_name);
      setStudentCount(data.student_count?.toString() ?? "");
      setTimezone(data.timezone ?? "");
    } catch (nextError) {
      setSectionAlert(
        "classroom",
        sectionError(nextError instanceof Error ? nextError.message : "Could not load classroom.", "Load failed"),
      );
    } finally {
      setLoading(false);
    }
  }, [clearSectionAlert, setSectionAlert]);

  useEffect(() => {
    void loadClassroom();
  }, [loadClassroom, syncKey]);

  const saveClassroom = async () => {
    if (classroom?.requires_school_setup) {
      setSectionAlert("classroom", sectionError("Complete school & district setup first.", "Setup required"));
      return;
    }
    if (!classroom?.has_active_school_year) {
      setSectionAlert("classroom", sectionError("Create an active school year before saving your classroom.", "School year required"));
      return;
    }
    if (!homeroomName.trim()) {
      setSectionAlert("classroom", sectionError("Enter a homeroom name.", "Missing homeroom"));
      return;
    }
    const count = Number(studentCount);
    if (!Number.isFinite(count) || count <= 0) {
      setSectionAlert("classroom", sectionError("Enter a valid student count.", "Invalid student count"));
      return;
    }

    setSaving(true);
    clearSectionAlert("classroom");
    try {
      await withPreservedScroll("my-classroom-panel", async () => {
        const data = await saveMyClassroom({
          homeroom_name: homeroomName.trim(),
          student_count: count,
          timezone: timezone.trim() || null,
        });
        setClassroom(data);
        setHomeroomName(data.homeroom_name);
        setStudentCount(data.student_count?.toString() ?? "");
        setTimezone(data.timezone ?? "");
        await onSaved?.();
      });
      setSectionAlert("classroom", sectionSuccess("Homeroom saved. Teaching subjects match your district setup."));
    } catch (nextError) {
      setSectionAlert(
        "classroom",
        sectionError(nextError instanceof Error ? nextError.message : "Could not save classroom.", "Save failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading classroom...</p>;
  }

  return (
    <div id="my-classroom-panel" className="space-y-5">
      <TeacherAssistInlineAlert alert={getSectionAlert("classroom")} onDismiss={() => clearSectionAlert("classroom")} />

      {classroom?.requires_school_setup ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          Complete School & District Setup first. Your grade level will appear here automatically.
        </div>
      ) : null}

      {classroom?.has_active_school_year && !classroom.class_id ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
          Your active school year is <span className="font-semibold">{formatSchoolYearLabel(classroom)}</span>.
          Save your classroom below to create the homeroom for this year.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="ta-label">School year</span>
          <input
            value={formatSchoolYearLabel(classroom)}
            readOnly
            className="ta-input bg-slate-50 text-slate-700"
          />
          <p className="text-xs text-slate-500">Inherited from the active school year in step 2.</p>
        </label>
        <label className="space-y-2">
          <span className="ta-label">Grade level</span>
          <input
            value={classroom?.grade_level ? `Grade ${classroom.grade_level}` : "Not set"}
            readOnly
            className="ta-input bg-slate-50 text-slate-700"
          />
          <p className="text-xs text-slate-500">Set from your district catalog placement.</p>
        </label>
        <label className="space-y-2">
          <span className="ta-label">Homeroom name</span>
          <input
            value={homeroomName}
            onChange={(event) => setHomeroomName(event.target.value)}
            className="ta-input"
            placeholder="5th Grade Homeroom"
            disabled={classroom?.requires_school_setup}
          />
        </label>
        <label className="space-y-2">
          <span className="ta-label">Student count</span>
          <input
            type="number"
            min={1}
            value={studentCount}
            onChange={(event) => setStudentCount(event.target.value)}
            className="ta-input"
            placeholder="23"
            disabled={classroom?.requires_school_setup}
          />
          <p className="text-xs text-slate-500">
            Anonymous STUDENT # range preview: 1-{Math.max(1, Number(studentCount || "1"))}
          </p>
        </label>
        <label className="space-y-2">
          <span className="ta-label">Timezone (optional)</span>
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="ta-input"
            placeholder="America/Chicago"
            disabled={classroom?.requires_school_setup}
          />
        </label>
      </div>

      {(classroom?.synced_subjects.length ?? 0) > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Teaching subjects</h3>
          <p className="mt-1 text-sm text-slate-600">Synced from your district catalog for this grade.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {classroom?.synced_subjects.map((subject) => (
              <span key={subject.catalog_subject_id} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                {subject.display_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="ta-button-primary"
        disabled={saving || classroom?.requires_school_setup}
        onClick={() => void saveClassroom()}
      >
        {saving ? "Saving..." : "Save classroom"}
      </button>
    </div>
  );
}
