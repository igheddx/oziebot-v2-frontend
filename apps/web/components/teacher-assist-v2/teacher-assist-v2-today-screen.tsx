"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchV2TodayClassroom } from "@/lib/teacher-assist-v2-api";
import type {
  TodayClassroom,
  SubjectToday,
  BeforeClassItem,
  TodayGradingItem,
  TodayRecoveryItem,
  TodayVerificationItem,
  TodayAlert,
  TodayTimeline,
  ClassroomInstructionProfile,
} from "@/lib/teacher-assist-v2-types";

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

// ── Alert banner ───────────────────────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: TodayAlert[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0];
  const color =
    top.priority === "CRITICAL" || top.priority === "HIGH"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-orange-200 bg-orange-50 text-orange-800";
  return (
    <div className={`rounded-xl border px-4 py-2.5 ${color}`}>
      <p className="text-xs font-semibold">{top.message}</p>
      {alerts.length > 1 && (
        <p className="mt-0.5 text-xs opacity-80">+{alerts.length - 1} more alert{alerts.length - 1 !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

// ── Morning brief ──────────────────────────────────────────────────────────────

function MorningBriefCard({ data }: { data: TodayClassroom["morning_brief"] }) {
  const readinessColor =
    data.readiness_statement.startsWith("You're ready")
      ? "text-emerald-700"
      : data.readiness_statement.startsWith("No lessons")
      ? "text-slate-500"
      : "text-amber-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {data.date_label}
          </p>
          <p className={`mt-1 text-sm font-semibold ${readinessColor}`}>
            {data.readiness_statement}
          </p>
        </div>
        {data.subject_names.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.subject_names.map((name) => (
              <span
                key={name}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {data.focus_items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {data.focus_items.map((item) => (
            <div key={item.subject} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {item.subject}
              </span>
              <p className="text-xs text-slate-700">{item.focus}</p>
            </div>
          ))}
        </div>
      )}

      {(data.pending_grade_count > 0 || data.recovery_today_count > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.pending_grade_count > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              {data.pending_grade_count} pending grade{data.pending_grade_count !== 1 ? "s" : ""}
            </span>
          )}
          {data.recovery_today_count > 0 && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
              {data.recovery_today_count} recovery item{data.recovery_today_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Before class checklist ─────────────────────────────────────────────────────

const ICON_MAP: Record<string, string> = {
  check: "✓",
  pending: "○",
  recovery: "◎",
  alert: "⚠",
  coaching: "→",
};

function BeforeClassChecklist({
  items,
  onArtifactClick,
  onGradeClick,
}: {
  items: BeforeClassItem[];
  onArtifactClick: (artifactId: string) => void;
  onGradeClick: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const ready = items.filter((i) => i.status === "ready").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Before Class</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {ready}/{items.length} ready
          </span>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <ul className="mt-3 space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span
                className={`mt-0.5 shrink-0 text-xs font-bold ${
                  item.status === "ready"
                    ? "text-emerald-500"
                    : item.status === "recovery"
                    ? "text-sky-500"
                    : item.status === "alert"
                    ? "text-amber-600"
                    : item.status === "coaching"
                    ? "text-violet-500"
                    : "text-slate-300"
                }`}
              >
                {ICON_MAP[item.icon] ?? "○"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs ${
                      item.status === "ready" ? "text-slate-800" : "text-slate-500"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.action === "view" && item.artifact_id && (
                    <button
                      onClick={() => onArtifactClick(item.artifact_id!)}
                      className="text-[10px] text-sky-600 hover:underline"
                    >
                      View
                    </button>
                  )}
                  {item.action === "present" && item.artifact_id && (
                    <button
                      onClick={() => onArtifactClick(item.artifact_id!)}
                      className="text-[10px] text-violet-600 hover:underline"
                    >
                      ▶ Open
                    </button>
                  )}
                  {item.action === "print" && item.artifact_id && (
                    <button
                      onClick={() => onArtifactClick(item.artifact_id!)}
                      className="text-[10px] text-slate-500 hover:underline"
                    >
                      Print
                    </button>
                  )}
                  {item.action === "grade" && (
                    <button
                      onClick={onGradeClick}
                      className="text-[10px] text-amber-700 hover:underline"
                    >
                      Grade now
                    </button>
                  )}
                </div>
                {item.note && (
                  <p className="mt-0.5 text-[10px] text-violet-700">{item.note}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Instructional timeline ─────────────────────────────────────────────────────

function TimelineRow({ slot }: { slot: TodayTimeline }) {
  const hour = Math.floor(slot.start_minute / 60);
  const min = slot.start_minute % 60;
  const timeLabel = `${hour}:${String(min).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-right text-[10px] font-mono text-slate-400">
        +{slot.start_minute}m
      </span>
      <div
        className={`h-px flex-1 ${
          slot.artifact_type ? "bg-sky-200" : "bg-slate-100"
        }`}
      />
      <span
        className={`text-xs ${
          slot.artifact_type ? "font-semibold text-sky-800" : "text-slate-600"
        }`}
      >
        {slot.label}
      </span>
      <span className="text-[10px] text-slate-400">({slot.duration_minutes} min)</span>
    </div>
  );
}

// ── Subject card ───────────────────────────────────────────────────────────────

const CIP_DELIVERY_LABELS: Record<string, string> = {
  teacher_read_aloud: "Read Aloud",
  shared_reading: "Shared Reading",
  students_have_individual_copies: "Individual Copies",
  small_group_reading: "Small Group",
  independent_reading: "Independent",
  guided_writing: "Guided Writing",
  independent_writing: "Independent Writing",
  shared_writing: "Shared Writing",
  teacher_choice: "Teacher Choice",
};

const CIP_CURRICULUM_ACCESS_LABELS: Record<string, string> = {
  teacher_copy_only: "Teacher Copy Only",
  projected_shared_display: "Projected",
  class_set: "Class Set",
  small_group_sets: "Small Group Sets",
  digital_student_access: "Digital",
  student_choice_text: "Student Choice",
};

const CIP_INDEP_ACCESS_LABELS: Record<string, string> = {
  classroom_library_available: "Classroom Library",
  school_library_available: "School Library",
  student_brought_books: "Home Books",
  digital_library: "Digital Library",
};

function CIPStrandBar({ profile }: { profile: ClassroomInstructionProfile }) {
  const slots = profile.strand_slots_today;
  if (!slots || slots.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {slots.map((slot, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-800"
        >
          <span className="font-semibold">{slot.strand_name}</span>
          {slot.minutes_per_day ? <span className="text-sky-500">{slot.minutes_per_day}m</span> : null}
          {slot.delivery_mode ? (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium">
              {CIP_DELIVERY_LABELS[slot.delivery_mode] ?? slot.delivery_mode}
            </span>
          ) : null}
          {slot.curriculum_text_access ? (
            <span className={slot.curriculum_text_access === "teacher_copy_only" ? "font-medium text-amber-600" : "text-sky-500"}>
              {CIP_CURRICULUM_ACCESS_LABELS[slot.curriculum_text_access] ?? slot.curriculum_text_access}
            </span>
          ) : null}
          {slot.independent_reading_access && slot.independent_reading_access !== "none" ? (
            <span className="text-slate-500">{CIP_INDEP_ACCESS_LABELS[slot.independent_reading_access] ?? slot.independent_reading_access}</span>
          ) : null}
          {slot.closure_required ? (
            <span className="text-[10px] font-medium text-sky-600">· Closure</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SubjectCard({
  subject,
  onArtifactClick,
  onRecoveryClick,
}: {
  subject: SubjectToday;
  onArtifactClick: (artifactId: string) => void;
  onRecoveryClick: (queueItemId: string) => void;
}) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);

  const presentArtifact =
    subject.artifacts["student_lesson_deck"] || subject.artifacts["subject_slide_deck"];
  const lessonPlan = subject.artifacts["daily_lesson_plan"];
  const bellRinger = subject.artifacts["bell_ringer"];
  const exitTicket = subject.artifacts["exit_ticket"];

  const tf = subject.teaching_focus;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {subject.week_label} · {subject.day_label}
          </p>
          <h3 className="mt-0.5 text-sm font-bold text-slate-900">{subject.subject_name}</h3>
          {subject.student_goal && (
            <p className="mt-1 text-xs text-slate-600 italic">"{subject.student_goal}"</p>
          )}
        </div>

        {/* Present button — primary action */}
        {presentArtifact && (
          <button
            onClick={() => onArtifactClick(presentArtifact.artifact_id)}
            className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
          >
            ▶ Present
          </button>
        )}
      </div>

      {/* Classroom Instruction Profile */}
      {subject.classroom_instruction_profile ? (
        <CIPStrandBar profile={subject.classroom_instruction_profile} />
      ) : null}

      {/* Teaching Focus */}
      {tf && (tf.coaching.length > 0 || tf.success_evidence) && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
            Today's Teaching Focus
          </p>
          <div className="mt-1 space-y-1">
            {tf.coaching.map((line, i) => (
              <p key={i} className="text-xs text-violet-900">{line}</p>
            ))}
            {tf.success_evidence && (
              <p className="text-xs text-violet-700">
                <span className="font-medium">Success:</span> {tf.success_evidence}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {lessonPlan && (
          <button
            onClick={() => onArtifactClick(lessonPlan.artifact_id)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Teacher Notes
          </button>
        )}
        {bellRinger && (
          <button
            onClick={() => onArtifactClick(bellRinger.artifact_id)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Bell Ringer
          </button>
        )}
        {exitTicket && (
          <button
            onClick={() => onArtifactClick(exitTicket.artifact_id)}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
          >
            Exit Ticket
          </button>
        )}
        <button
          onClick={() => setShowTimeline((v) => !v)}
          className="rounded-lg border border-slate-100 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600"
        >
          {showTimeline ? "Hide Timeline" : "Timeline"}
        </button>
      </div>

      {/* Timeline */}
      {showTimeline && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
          {subject.timeline.map((slot, i) => (
            <TimelineRow key={i} slot={slot} />
          ))}
        </div>
      )}

      {/* Recovery block */}
      {subject.recovery_items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {subject.recovery_items.map((r) => (
            <div
              key={r.queue_item_id}
              className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3 py-2"
            >
              <div>
                <span
                  className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    PRIORITY_COLORS[r.priority] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.priority}
                </span>
                <span className="text-xs text-sky-800">
                  Recovery {r.objective_code ? `— ${r.objective_code}` : ""} · {r.recommendation_type.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={() => onRecoveryClick(r.queue_item_id)}
                className="text-xs text-sky-600 hover:underline"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Exit ticket stem */}
      {subject.exit_ticket_stem && (
        <p className="mt-3 text-xs text-slate-400">
          <span className="font-medium">Exit ticket:</span> {subject.exit_ticket_stem}
        </p>
      )}

      {/* Tomorrow toggle */}
      {subject.tomorrow && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            onClick={() => setShowTomorrow((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {showTomorrow ? "Hide tomorrow" : "→ Tomorrow: " + (subject.tomorrow.student_goal || subject.tomorrow.teacher_goal || subject.tomorrow.day_label || "Next lesson")}
          </button>
          {showTomorrow && subject.tomorrow && (
            <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2.5">
              {subject.tomorrow.builds_on_today && (
                <p className="text-xs text-slate-600">
                  <span className="font-medium">Builds on today:</span> {subject.tomorrow.builds_on_today}
                </p>
              )}
              {subject.tomorrow.student_goal && (
                <p className="text-xs text-slate-600">
                  <span className="font-medium">Tomorrow's goal:</span> {subject.tomorrow.student_goal}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Grading queue ──────────────────────────────────────────────────────────────

function GradingQueue({
  items,
  onGradeClick,
}: {
  items: TodayGradingItem[];
  onGradeClick: (assignmentId: string) => void;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((n, i) => n + i.pending_grade_count, 0);

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-900">Grading Queue</h2>
        <span className="text-xs text-amber-700">{total} pending</span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.assignment_id} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-900">{item.title}</p>
              <p className="text-[10px] text-amber-700">{item.pending_grade_count} awaiting review</p>
            </div>
            <button
              onClick={() => onGradeClick(item.assignment_id)}
              className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Grade
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Verification due ───────────────────────────────────────────────────────────

function VerificationDue({
  items,
  onRecordClick,
}: {
  items: TodayVerificationItem[];
  onRecordClick: (queueItemId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <h2 className="text-sm font-semibold text-indigo-900">Recovery Verification Due</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.queue_item_id} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-900">
                {item.objective_code ?? "Recovery item"}
              </p>
              <p className="text-[10px] text-indigo-700">
                Completed {item.days_since_completion} day{item.days_since_completion !== 1 ? "s" : ""} ago · {item.evaluation_window_days}d window
              </p>
              {item.misconception_text && (
                <p className="text-[10px] text-indigo-600 mt-0.5">{item.misconception_text}</p>
              )}
            </div>
            <button
              onClick={() => onRecordClick(item.queue_item_id)}
              className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
            >
              Record Outcome
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── End of day ─────────────────────────────────────────────────────────────────

function EndOfDaySection({ data }: { data: TodayClassroom["end_of_day"] }) {
  const [expanded, setExpanded] = useState(false);

  const hasContent =
    data.recovery_completed_today > 0 ||
    data.remaining_grading > 0 ||
    data.verification_pending > 0 ||
    data.tomorrow_focuses.length > 0;

  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">End of Day</h2>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {/* Always-visible summary row */}
      <div className="mt-2 flex flex-wrap gap-3">
        {data.recovery_completed_today > 0 && (
          <span className="text-xs text-emerald-700">
            ✓ {data.recovery_completed_today} recovery completed today
          </span>
        )}
        {data.remaining_grading > 0 && (
          <span className="text-xs text-amber-700">
            {data.remaining_grading} still awaiting grading
          </span>
        )}
        {data.verification_pending > 0 && (
          <span className="text-xs text-indigo-700">
            {data.verification_pending} recovery verification pending
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {data.tomorrow_focuses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Tomorrow's Focus
              </p>
              <div className="mt-1.5 space-y-1.5">
                {data.tomorrow_focuses.map((tf) => (
                  <div key={tf.subject}>
                    <p className="text-xs font-medium text-slate-700">{tf.subject}</p>
                    {tf.focus && <p className="text-xs text-slate-600">{tf.focus}</p>}
                    {tf.builds_on_today && (
                      <p className="text-[10px] text-slate-400">
                        Builds on: {tf.builds_on_today}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.reflection_prompt && (
            <p className="text-xs italic text-slate-500">{data.reflection_prompt}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function NoLessonsToday() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
      <p className="text-sm font-medium text-slate-600">No lessons scheduled for today.</p>
      <p className="mt-1 text-xs text-slate-400">
        Check your active packages or generate a new instructional package.
      </p>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

type Props = {
  onArtifactClick?: (artifactId: string) => void;
  onGradeClick?: (assignmentId: string) => void;
  onRecoveryClick?: (queueItemId: string) => void;
  onDataLoaded?: (data: TodayClassroom) => void;
};

export function TeacherAssistV2TodayScreen({
  onArtifactClick,
  onGradeClick,
  onRecoveryClick,
  onDataLoaded,
}: Props) {
  const [data, setData] = useState<TodayClassroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchV2TodayClassroom();
      setData(result);
      onDataLoaded?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Today workspace.");
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm font-semibold text-rose-800">Could not load Today</p>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
        <button
          onClick={load}
          className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const handleArtifact = (id: string) => onArtifactClick?.(id);
  const handleGrade = (id: string) => onGradeClick?.(id);
  const handleRecovery = (id: string) => onRecoveryClick?.(id);
  const handleGradeQueue = () => {
    if (data.grading_queue.length > 0) {
      handleGrade(data.grading_queue[0].assignment_id);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-900">Today</h1>
        <button
          onClick={load}
          className="text-xs text-sky-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={data.alerts} />

      {/* Morning Brief */}
      <MorningBriefCard data={data.morning_brief} />

      {/* Before Class */}
      <BeforeClassChecklist
        items={data.before_class}
        onArtifactClick={handleArtifact}
        onGradeClick={handleGradeQueue}
      />

      {/* Subject cards */}
      {data.subjects_today.length === 0 ? (
        <NoLessonsToday />
      ) : (
        data.subjects_today.map((subject) => (
          <SubjectCard
            key={`${subject.package_id}-${subject.subject_id}`}
            subject={subject}
            onArtifactClick={handleArtifact}
            onRecoveryClick={handleRecovery}
          />
        ))
      )}

      {/* Grading queue */}
      <GradingQueue items={data.grading_queue} onGradeClick={handleGrade} />

      {/* Recovery verification */}
      <VerificationDue
        items={data.verification_due}
        onRecordClick={handleRecovery}
      />

      {/* End of Day */}
      <EndOfDaySection data={data.end_of_day} />
    </div>
  );
}
