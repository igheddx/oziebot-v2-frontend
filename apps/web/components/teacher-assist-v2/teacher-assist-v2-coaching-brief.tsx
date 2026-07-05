"use client";

import { useState } from "react";

import { formatDayLabel } from "@/lib/teaching-mode-slides";
import type { TeachingBriefDay, TeachingBriefSubject, TeacherTeachingBrief } from "@/lib/teacher-assist-v2-types";

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONFIDENCE_STYLE = {
  "Ready":           { ring: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500", label: "text-emerald-800", note: "text-emerald-700" },
  "Ready with Notes":{ ring: "border-amber-200 bg-amber-50",   dot: "bg-amber-500",   label: "text-amber-800",  note: "text-amber-700"  },
  "Needs Review":    { ring: "border-rose-200 bg-rose-50",      dot: "bg-rose-500",    label: "text-rose-800",   note: "text-rose-700"   },
} as const;

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-sm font-semibold text-slate-700 hover:text-slate-900"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="ml-3 text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

// ── Subject card ──────────────────────────────────────────────────────────────

function SubjectBrief({ brief }: { brief: TeachingBriefSubject }) {
  const { level, explanation } = brief.lesson_snapshot.confidence;
  const cs = CONFIDENCE_STYLE[level] ?? CONFIDENCE_STYLE["Ready"];

  const hasMisconceptions = brief.classroom_support.common_misconceptions.length > 0;
  const hasInTheMoment   = brief.classroom_support.in_the_moment.length > 0;
  const hasStruggles     = !!(brief.student_support.if_struggling.scaffold_recommendation || brief.student_support.if_struggling.reteach_strategy);
  const hasExtension     = !!(brief.student_support.if_mastering_quickly.extension_activity || brief.student_support.if_mastering_quickly.enrichment_discussion);

  return (
    <div className="space-y-0">
      {/* ── Lesson Snapshot ── */}
      <div className={`rounded-xl border px-4 py-3.5 mb-4 ${cs.ring}`}>
        {/* Confidence row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cs.dot}`} aria-hidden />
          <span className={`text-sm font-semibold ${cs.label}`}>{level}</span>
          <span className={`text-xs ${cs.note}`}>{explanation}</span>
        </div>

        {/* Learning target */}
        {brief.lesson_snapshot.learning_target ? (
          <div className="mb-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Learning Target</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 leading-snug">
              {brief.lesson_snapshot.learning_target}
            </p>
          </div>
        ) : null}

        {/* Meta pills */}
        <div className="flex flex-wrap gap-2">
          {brief.lesson_snapshot.lesson_time_minutes ? (
            <span className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600">
              {brief.lesson_snapshot.lesson_time_minutes} min
            </span>
          ) : null}
          {brief.lesson_snapshot.assessment ? (
            <span className="rounded-lg bg-white/70 px-2.5 py-1 text-xs text-slate-600 max-w-xs truncate">
              Exit: {brief.lesson_snapshot.assessment}
            </span>
          ) : null}
        </div>

        {/* Key misconception */}
        {brief.lesson_snapshot.key_misconception ? (
          <div className="mt-3 border-t border-black/5 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Watch for today</p>
            <p className="text-xs text-slate-700 leading-relaxed">{brief.lesson_snapshot.key_misconception}</p>
          </div>
        ) : null}
      </div>

      {/* ── Before Class ── */}
      {brief.before_class.preparation_tasks.length > 0 ? (
        <Section label="Before Class" defaultOpen>
          <ul className="space-y-2">
            {brief.before_class.preparation_tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-300 bg-white"
                  aria-hidden
                />
                {task}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── Today's Lesson ── */}
      {brief.daily_brief.big_idea ? (
        <Section label="Today's Lesson">
          <div className="space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{brief.daily_brief.big_idea}</p>
            {brief.daily_brief.why_it_matters ? (
              <p className="text-xs italic text-slate-500 leading-relaxed">{brief.daily_brief.why_it_matters}</p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* ── Pacing Guide ── */}
      <Section label={`Pacing Guide — ${brief.estimated_timing.total_minutes} min`}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {brief.estimated_timing.segments.map((seg) => (
              <div
                key={seg.name}
                className={`rounded-lg px-2.5 py-1.5 text-xs leading-none ${
                  seg.skippable
                    ? "bg-slate-100 text-slate-500"
                    : "bg-violet-50 text-violet-800"
                }`}
              >
                <span className="font-medium">{seg.name}</span>
                <span className="ml-1 opacity-60">{seg.minutes}m</span>
                {seg.flexible && seg.trim_to_minutes && !seg.skippable ? (
                  <span className="ml-0.5 opacity-40 text-[10px]">→{seg.trim_to_minutes}m</span>
                ) : null}
              </div>
            ))}
          </div>
          {brief.estimated_timing.if_running_behind ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <span className="font-semibold">If running behind: </span>
              {brief.estimated_timing.if_running_behind}
            </div>
          ) : null}
        </div>
      </Section>

      {/* ── Critical Moments ── */}
      {brief.critical_moments.length > 0 ? (
        <Section label="Critical Moments" defaultOpen>
          <div className="space-y-3">
            {brief.critical_moments.map((cm, i) => (
              <div key={i} className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600">
                  {cm.moment}
                </p>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed">{cm.why_it_matters}</p>
                <p className="mt-1.5 text-xs italic text-slate-500 leading-relaxed">{cm.suggested_move}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── In the Classroom ── */}
      {(hasMisconceptions || hasInTheMoment || brief.classroom_support.mastery_looks_like) ? (
        <Section label="In the Classroom">
          <div className="space-y-4">
            {hasMisconceptions ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  Common misconceptions
                </p>
                <ul className="space-y-1.5">
                  {brief.classroom_support.common_misconceptions.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hasInTheMoment ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  In the moment
                </p>
                <ul className="space-y-1.5">
                  {brief.classroom_support.in_the_moment.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {brief.classroom_support.mastery_looks_like ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 mb-0.5">
                  Mastery looks like
                </p>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  {brief.classroom_support.mastery_looks_like}
                </p>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* ── Student Support ── */}
      {(hasStruggles || hasExtension) ? (
        <Section label="Student Support">
          <div className="space-y-4">
            {hasStruggles ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  If students are stuck
                </p>
                {brief.student_support.if_struggling.scaffold_recommendation ? (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {brief.student_support.if_struggling.scaffold_recommendation}
                  </p>
                ) : null}
                {brief.student_support.if_struggling.reteach_strategy ? (
                  <p className="mt-1 text-xs italic text-slate-500 leading-relaxed">
                    {brief.student_support.if_struggling.reteach_strategy}
                  </p>
                ) : null}
              </div>
            ) : null}
            {hasExtension ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  If students are ready for more
                </p>
                {brief.student_support.if_mastering_quickly.extension_activity ? (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {brief.student_support.if_mastering_quickly.extension_activity}
                  </p>
                ) : null}
                {brief.student_support.if_mastering_quickly.enrichment_discussion ? (
                  <p className="mt-1 text-xs italic text-slate-500 leading-relaxed">
                    {brief.student_support.if_mastering_quickly.enrichment_discussion}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* ── After This Lesson ── */}
      {brief.after_lesson.reflection_prompts.length > 0 ? (
        <Section label="After This Lesson">
          <ul className="space-y-2">
            {brief.after_lesson.reflection_prompts.map((prompt, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                {prompt}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function TeachingBriefPanel({
  brief: fullBrief,
  selectedDay,
}: {
  brief: TeacherTeachingBrief | null | undefined;
  selectedDay: string | null;
}) {
  const [activeSubjectIndex, setActiveSubjectIndex] = useState(0);

  if (!fullBrief || !selectedDay) return null;

  const dayEntry: TeachingBriefDay | undefined = fullBrief.days.find(
    (d) => d.day_label === selectedDay,
  );
  if (!dayEntry || dayEntry.subjects.length === 0) return null;

  const safeIndex = Math.min(activeSubjectIndex, dayEntry.subjects.length - 1);
  const subject = dayEntry.subjects[safeIndex];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Card header */}
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Today's Teaching Brief
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {formatDayLabel(selectedDay)}
            </p>
          </div>
          {/* Subject tabs for multi-subject days */}
          {dayEntry.subjects.length > 1 ? (
            <div className="flex gap-1.5 shrink-0">
              {dayEntry.subjects.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    i === safeIndex
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => setActiveSubjectIndex(i)}
                >
                  {s.subject_name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4">
        <SubjectBrief brief={subject} />
      </div>
    </div>
  );
}
