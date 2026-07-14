"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import { closeOutV2InstructionalPackage, fetchV2InstructionalPackage, pollV2PackageStatus, setArtifactDevLock, triggerPackageImageFetch, triggerV2PackageRegen } from "@/lib/teacher-assist-v2-api";
import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import { sortDailyPlans } from "@/lib/teaching-mode-slides";
import { QuizArtifactCard } from "@/components/teacher-assist-v2/teacher-assist-v2-quiz-artifact-card";
import { TeacherAssistV2AddAssignmentPanel } from "@/components/teacher-assist-v2/teacher-assist-v2-add-assignment-panel";
import { TeacherAssistV2RubricEditor } from "@/components/teacher-assist-v2/teacher-assist-v2-rubric-editor";
import type { ArtifactQualityReview, CrossStrandConnection, CurriculumResourceAlignment, InstructionalPackageArtifact, InstructionalPackageDetail, LessonPlanSubjectBlock, StrandJourney, StrandLearningJourneys, StrandObjective } from "@/lib/teacher-assist-v2-types";

const DELIVERY_MODE_LABELS: Record<string, string> = {
  teacher_read_aloud: "Teacher Read Aloud",
  shared_reading: "Shared Reading",
  students_have_individual_copies: "Student Individual Copies",
  small_group_reading: "Small Group",
  independent_reading: "Independent Reading",
  guided_writing: "Guided Writing",
  independent_writing: "Independent Writing",
  shared_writing: "Shared Writing",
  teacher_choice: "Teacher Choice",
};

const CURRICULUM_TEXT_ACCESS_LABELS: Record<string, string> = {
  teacher_copy_only: "Teacher Copy Only",
  projected_shared_display: "Projected / Shared Display",
  class_set: "Class Set",
  small_group_sets: "Small Group Sets",
  digital_student_access: "Digital (student devices)",
  student_choice_text: "Student Choice",
};

const INDEPENDENT_READING_ACCESS_LABELS: Record<string, string> = {
  classroom_library_available: "Classroom Library",
  school_library_available: "School Library",
  student_brought_books: "Student-Brought Books",
  digital_library: "Digital Library",
  none: "None",
};

function ClassroomInstructionProfileCard({
  profile,
}: {
  profile: NonNullable<InstructionalPackageDetail["instructional_delivery_profile"]>;
}) {
  const modeLabel =
    profile.mode === "daily_balanced"
      ? "Daily Balanced"
      : profile.mode === "block_schedule"
        ? "Block Schedule"
        : profile.mode;
  const strands = profile.strands ?? [];
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm">
      <p className="font-semibold text-slate-900">Classroom Instruction Profile</p>
      <p className="mt-0.5 text-xs text-slate-500">Mode: {modeLabel}</p>
      {strands.length > 0 ? (
        <div className="mt-2 space-y-2">
          {strands.map((strand, i) => (
            <div key={i} className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">{strand.strand_name}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
                {strand.minutes_per_day ? <span>{strand.minutes_per_day} min/day</span> : null}
                {strand.delivery_mode ? (
                  <span>Delivery: {DELIVERY_MODE_LABELS[strand.delivery_mode] ?? strand.delivery_mode}</span>
                ) : null}
                {strand.curriculum_text_access ? (
                  <span className={strand.curriculum_text_access === "teacher_copy_only" ? "font-medium text-amber-700" : undefined}>
                    Curriculum text: {CURRICULUM_TEXT_ACCESS_LABELS[strand.curriculum_text_access] ?? strand.curriculum_text_access}
                  </span>
                ) : null}
                {strand.independent_reading_access && strand.independent_reading_access !== "none" ? (
                  <span>Indep. reading: {INDEPENDENT_READING_ACCESS_LABELS[strand.independent_reading_access] ?? strand.independent_reading_access}</span>
                ) : null}
                {strand.closure_required ? <span className="font-medium text-sky-700">Closure Required</span> : null}
                {strand.days && strand.days.length < 5 ? (
                  <span>{strand.days.map((d) => d.slice(0, 3)).join(", ")}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  read_aloud: "Read Aloud",
  mentor_text: "Mentor Text",
  shared_reading: "Shared Reading",
  independent_reading: "Independent Reading",
  passage: "Passage",
  poem: "Poem",
  article: "Article",
  other: "Other",
};

const EXTRACTION_SOURCE_LABELS: Record<string, string> = {
  structured_materials_needed: "Pacing Guide (structured)",
  structured_pacing_context: "Pacing Guide",
  ai_sequence_plan: "AI-confirmed",
  regex_document: "Extracted from document",
};

// Strategy labels mirror STRATEGY_LIBRARY keys in instructional_variety.py
const STRATEGY_LABELS: Record<string, string> = {
  turn_and_talk: "Turn and Talk",
  think_pair_share: "Think-Pair-Share",
  quick_write: "Quick Write",
  picture_walk: "Picture Walk",
  vocabulary_sort: "Vocabulary Sort",
  gallery_walk: "Gallery Walk",
  notebook_reflection: "Notebook Reflection",
  anchor_chart: "Anchor Chart",
  partner_discussion: "Partner Discussion",
  teacher_modeling: "Teacher Modeling",
  graphic_organizer: "Graphic Organizer",
};

const STRATEGY_KEYWORDS: Record<string, string[]> = {
  turn_and_talk: ["turn and talk", "turn-and-talk"],
  think_pair_share: ["think-pair-share", "think pair share"],
  quick_write: ["quick write", "quick-write"],
  picture_walk: ["picture walk", "picture-walk"],
  vocabulary_sort: ["vocabulary sort", "word sort"],
  gallery_walk: ["gallery walk"],
  notebook_reflection: ["notebook reflection", "notebook entry", "notebook response"],
  anchor_chart: ["anchor chart"],
  partner_discussion: ["partner discussion", "partner talk"],
  teacher_modeling: ["teacher modeling", "teacher model", "think aloud", "think-aloud"],
  graphic_organizer: ["graphic organizer", "t-chart", "venn diagram"],
};

// Strategy categories — must mirror CORE_PRACTICES / INSTRUCTIONAL_SUPPORTS /
// ENGAGEMENT_STRATEGIES in instructional_variety.py
const CORE_PRACTICES = new Set(["teacher_modeling"]);
const INSTRUCTIONAL_SUPPORTS = new Set(["graphic_organizer", "anchor_chart"]);
const ENGAGEMENT_STRATEGIES = new Set([
  "turn_and_talk", "think_pair_share", "quick_write", "picture_walk",
  "vocabulary_sort", "gallery_walk", "notebook_reflection", "partner_discussion",
]);

// Configurable thresholds (mirrors instructional_variety.py constants)
const ENGAGEMENT_OVERUSE_RATIO = 0.40;   // flag if used in ≥40% of days
const CONSECUTIVE_SUPPORT_THRESHOLD = 3; // flag support tool used N+ consecutive days

function detectStrategies(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.keys(STRATEGY_KEYWORDS).filter((key) =>
    STRATEGY_KEYWORDS[key].some((kw) => lower.includes(kw))
  );
}

const FOCUS_LABELS: Record<string, string> = {
  introduce: "Introduce",
  deepen: "Deepen",
  apply: "Apply",
  extend: "Extend",
  assess: "Assess",
};

const FOCUS_COLORS: Record<string, string> = {
  introduce: "bg-violet-100 text-violet-800 border-violet-200",
  deepen: "bg-sky-100 text-sky-800 border-sky-200",
  apply: "bg-emerald-100 text-emerald-800 border-emerald-200",
  extend: "bg-amber-100 text-amber-800 border-amber-200",
  assess: "bg-rose-100 text-rose-800 border-rose-200",
};

function ObjectiveNode({
  obj,
  isActive,
  connections,
}: {
  obj: StrandObjective;
  isActive: boolean;
  connections: CrossStrandConnection[];
}) {
  const [hovering, setHovering] = useState(false);
  const focusColor = FOCUS_COLORS[obj.instructional_focus ?? ""] ?? "bg-slate-100 text-slate-700 border-slate-200";
  const bubbleClass = isActive
    ? "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-violet-600 text-white shadow ring-2 ring-violet-300"
    : "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-slate-300 bg-white text-slate-500";

  return (
    <div className="relative flex flex-col items-center gap-1" style={{ minWidth: 56 }}>
      <div
        className={bubbleClass + " cursor-default"}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {obj.sequence}
      </div>
      {/* Focus badge */}
      {obj.instructional_focus ? (
        <span className={`rounded border px-1 py-px text-[9px] font-semibold ${focusColor}`}>
          {FOCUS_LABELS[obj.instructional_focus] ?? obj.instructional_focus}
        </span>
      ) : null}
      {/* Preteach indicator */}
      {obj.requires_preteach ? (
        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">Preteach</span>
      ) : null}
      {/* Tooltip on hover */}
      {hovering ? (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-lg text-xs text-slate-700">
          <p className="font-semibold text-slate-900 mb-0.5">Objective {obj.sequence}</p>
          <p className="text-[11px] leading-snug">{obj.objective}</p>
          {obj.curriculum_resource ? (
            <p className="mt-1 text-[11px] text-slate-500">
              <span className="font-medium">Resource:</span> {obj.curriculum_resource}
            </p>
          ) : null}
          {obj.mastery_evidence ? (
            <p className="mt-1 text-[11px] text-slate-500">
              <span className="font-medium">Mastery:</span> {obj.mastery_evidence}
            </p>
          ) : null}
          {connections.map((conn, i) => (
            <p key={i} className="mt-1 text-[11px] text-sky-600">
              ↔ {conn.connected_strand}: {conn.connection}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StrandJourneyCard({
  journey,
  weekStart,
  weekEnd,
}: {
  journey: StrandJourney;
  weekStart: number;
  weekEnd: number;
}) {
  const [showBindings, setShowBindings] = useState(false);
  const objectives = journey.objectives ?? [];
  const bindings = journey.resource_bindings ?? [];
  const connections = journey.cross_strand_connections ?? [];

  // Current = objectives whose week falls within weekStart..weekEnd
  const activeWeeks = new Set(
    Array.from({ length: weekEnd - weekStart + 1 }, (_, i) => weekStart + i)
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{journey.strand_name}</p>
          {journey.total_instructional_days ? (
            <p className="text-[11px] text-slate-500">
              {journey.total_instructional_days} instructional day{journey.total_instructional_days !== 1 ? "s" : ""}
              {objectives.length ? ` · ${objectives.length} objective${objectives.length !== 1 ? "s" : ""}` : ""}
            </p>
          ) : null}
        </div>
        {bindings.length > 0 ? (
          <button
            type="button"
            className="text-[11px] text-sky-600 hover:underline shrink-0"
            onClick={() => setShowBindings((v) => !v)}
          >
            {showBindings ? "Hide resources" : `${bindings.length} resource binding${bindings.length !== 1 ? "s" : ""}`}
          </button>
        ) : null}
      </div>

      {/* Objective timeline */}
      {objectives.length > 0 ? (
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {objectives.map((obj, idx) => {
            const isActive = activeWeeks.has(obj.week);
            const objConnections = connections.filter(
              (c) => c.at_objective_sequence === obj.sequence
            );
            return (
              <div key={obj.sequence} className="flex items-center">
                <ObjectiveNode obj={obj} isActive={isActive} connections={objConnections} />
                {idx < objectives.length - 1 ? (
                  <div className="w-4 h-px bg-slate-300 flex-shrink-0 mx-0.5" />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Resource bindings (expanded) */}
      {showBindings && bindings.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            Resource → Objective Bindings
          </p>
          {bindings.map((binding, i) => {
            const seqs = binding.bound_to_objective_sequences ?? [];
            return (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="font-medium text-slate-700 truncate max-w-[10rem]" title={binding.resource_title}>
                  {binding.resource_title}
                </span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-600">
                  Objective{seqs.length !== 1 ? "s" : ""} {seqs.join(", ")}
                </span>
                {binding.binding_reason ? (
                  <span className="text-slate-400 italic truncate">{binding.binding_reason}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LearningJourneyPanel({
  journeys,
  weekStart,
  weekEnd,
}: {
  journeys: StrandLearningJourneys | null | undefined;
  weekStart: number;
  weekEnd: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!journeys?.strand_journeys) return null;

  const strandEntries = Object.values(journeys.strand_journeys);
  if (strandEntries.length === 0) return null;

  const durationLabel = journeys.curriculum_duration_weeks
    ? `${journeys.curriculum_duration_weeks}-week curriculum`
    : null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="font-semibold text-slate-900">
            Learning Journeys
            {durationLabel ? (
              <span className="ml-2 text-xs font-normal text-violet-600">{durationLabel}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {strandEntries.length} strand{strandEntries.length !== 1 ? "s" : ""} · hover objectives for detail · highlighted = current weeks
          </p>
        </div>
        <span className="text-xs text-slate-400 shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {strandEntries.map((journey) => (
            <StrandJourneyCard
              key={journey.strand_name}
              journey={journey}
              weekStart={weekStart}
              weekEnd={weekEnd}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StrategyVarietyCard({ artifacts }: { artifacts: InstructionalPackageArtifact[] }) {
  const [expanded, setExpanded] = useState(false);

  // Collect strategy usage per day (only lesson plan artifacts)
  const usageByDay = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of artifacts) {
      if (a.artifact_type !== "daily_lesson_plan" || !a.content_json) continue;
      const label = formatDayLabel(a.day_label) || a.title || "Unknown";
      const text = JSON.stringify(a.content_json);
      map[label] = detectStrategies(text);
    }
    return map;
  }, [artifacts]);

  const totalDays = Object.keys(usageByDay).length;
  if (totalDays === 0) return null;

  // Count how often each strategy appears
  const strategyCounts: Record<string, number> = {};
  for (const strategies of Object.values(usageByDay)) {
    for (const s of strategies) {
      strategyCounts[s] = (strategyCounts[s] ?? 0) + 1;
    }
  }
  const sortedStrategies = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1]);
  const orderedDays = Object.keys(usageByDay);

  // Engagement strategies: overused if appear in ≥40% of days (and more than once).
  // Core practices are never flagged. Instructional supports flagged only on consecutive streak.
  const engagementOverused = new Set(
    sortedStrategies
      .filter(([key, count]) =>
        ENGAGEMENT_STRATEGIES.has(key) && count > 1 && count / totalDays >= ENGAGEMENT_OVERUSE_RATIO
      )
      .map(([key]) => key)
  );
  const supportOverused = new Set<string>();
  for (const key of INSTRUCTIONAL_SUPPORTS) {
    let streak = 0;
    for (const day of orderedDays) {
      if (usageByDay[day].includes(key)) {
        streak++;
        if (streak >= CONSECUTIVE_SUPPORT_THRESHOLD) { supportOverused.add(key); break; }
      } else {
        streak = 0;
      }
    }
  }
  const overusedKeys = new Set([...engagementOverused, ...supportOverused]);

  // Unused section: only show engagement strategies + supports (core practices are always expected).
  const unusedKeys = Object.keys(STRATEGY_LABELS).filter(
    (k) => !strategyCounts[k] && !CORE_PRACTICES.has(k)
  );

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="font-semibold text-slate-900">Instructional Variety</p>
          <p className="text-xs text-slate-500">
            {sortedStrategies.length} of {Object.keys(STRATEGY_LABELS).length} strategies used across {totalDays} day{totalDays !== 1 ? "s" : ""}
            {overusedKeys.size > 0 ? ` · ${overusedKeys.size} overused` : ""}
          </p>
        </div>
        <span className="text-xs text-violet-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {/* Strategy usage frequency */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Strategy Frequency</p>
            <div className="flex flex-wrap gap-1.5">
              {sortedStrategies.map(([key, count]) => (
                <span
                  key={key}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    overusedKeys.has(key)
                      ? "bg-amber-100 text-amber-800"
                      : "bg-violet-100 text-violet-800"
                  }`}
                >
                  {STRATEGY_LABELS[key] ?? key} ×{count}
                  {overusedKeys.has(key) ? " ⚠" : ""}
                </span>
              ))}
            </div>
            {overusedKeys.size > 0 ? (
              <p className="mt-1.5 text-[11px] text-amber-700">
                Strategies marked ⚠ appear frequently. Consider varying engagement approaches across lessons.
              </p>
            ) : null}
          </div>

          {/* Unused strategies */}
          {unusedKeys.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-500">Additional strategies that may fit future lessons</p>
              <div className="flex flex-wrap gap-1">
                {unusedKeys.map((key) => (
                  <span key={key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {STRATEGY_LABELS[key]}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Per-day breakdown */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">By Day</p>
            <div className="space-y-1">
              {Object.entries(usageByDay).map(([day, strategies]) => (
                <div key={day} className="flex items-start gap-2 text-xs">
                  <span className="w-28 shrink-0 font-medium text-slate-700">{day}</span>
                  <span className="text-slate-600">
                    {strategies.length > 0
                      ? strategies.map((k) => STRATEGY_LABELS[k] ?? k).join(", ")
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CurriculumResourceAlignmentCard({ alignment }: { alignment: CurriculumResourceAlignment }) {
  const [expanded, setExpanded] = useState(false);
  const weekKeys = Object.keys(alignment.weeks).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return na - nb;
  });
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Any Day", "All Days"];

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="font-semibold text-slate-900">Curriculum Resource Alignment</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {alignment.total_resources} district-assigned resource{alignment.total_resources !== 1 ? "s" : ""} mapped across {weekKeys.length} week{weekKeys.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="ml-2 text-xs text-emerald-600">{expanded ? "Hide" : "Show"}</span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-4">
          {weekKeys.map((weekKey) => {
            const dayMap = alignment.weeks[weekKey];
            const days = Object.keys(dayMap).sort(
              (a, b) => (dayOrder.indexOf(a) + 99) % 99 - (dayOrder.indexOf(b) + 99) % 99
            );
            return (
              <div key={weekKey}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{weekKey}</p>
                <div className="space-y-1.5">
                  {days.map((day) => {
                    const strandMap = dayMap[day];
                    const strands = Object.keys(strandMap);
                    return (
                      <div key={day} className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                        <p className="mb-1 text-[11px] font-medium text-slate-500">{day}</p>
                        <div className="space-y-1">
                          {strands.map((strand) => {
                            const resources = strandMap[strand];
                            return resources.map((r, ri) => (
                              <div key={`${strand}-${ri}`} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 text-xs">
                                {strand !== "General" ? (
                                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{strand}</span>
                                ) : null}
                                <span className="font-semibold text-slate-800">{r.title}</span>
                                <span className="text-slate-400">{RESOURCE_TYPE_LABELS[r.resource_type ?? ""] ?? r.resource_type}</span>
                                {r.theme ? <span className="text-slate-500">Theme: {r.theme}</span> : null}
                                {r.topic ? <span className="text-slate-500">Focus: {r.topic}</span> : null}
                                {r.allowed_uses.length > 0 ? (
                                  <span className="text-slate-400">Uses: {r.allowed_uses.slice(0, 3).join(", ")}{r.allowed_uses.length > 3 ? "…" : ""}</span>
                                ) : null}
                                <span className="text-[10px] text-slate-300">
                                  {EXTRACTION_SOURCE_LABELS[r.extraction_source ?? ""] ?? r.extraction_source}
                                </span>
                              </div>
                            ));
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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

function formatDayLabel(dayLabel: string | null | undefined): string {
  if (!dayLabel) return "Day";
  // ID-{n} format from v3 pacing engine → "Instructional Day N"
  const match = dayLabel.match(/^ID-(\d+)$/);
  if (match) return `Instructional Day ${match[1]}`;
  return dayLabel;
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

// ── Quality Review UI ─────────────────────────────────────────────────────────

const REVIEW_STATUS_STYLES: Record<string, string> = {
  ready:                       "bg-emerald-50 text-emerald-800 border-emerald-200",
  ready_with_notes:            "bg-sky-50 text-sky-800 border-sky-200",
  needs_review:                "bg-amber-50 text-amber-800 border-amber-200",
  missing_curriculum_resource: "bg-rose-50 text-rose-800 border-rose-200",
  image_review_needed:         "bg-violet-50 text-violet-800 border-violet-200",
  continuity_review_needed:    "bg-orange-50 text-orange-800 border-orange-200",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  ready:                       "Ready",
  ready_with_notes:            "Ready with Notes",
  needs_review:                "Needs Review",
  missing_curriculum_resource: "Missing Resource",
  image_review_needed:         "Image Review",
  continuity_review_needed:    "Continuity Review",
};

const CATEGORY_LABELS: Record<string, string> = {
  curriculum_fidelity:      "Curriculum Fidelity",
  instructional_continuity: "Instructional Continuity",
  classroom_authenticity:   "Classroom Authenticity",
  instructional_rhythm:     "Instructional Rhythm",
  lesson_variety:           "Lesson Variety",
  images:                   "Images",
  cognitive_load:           "Cognitive Load",
  teacher_experience:       "Teacher Experience",
};

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-sky-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
}

function QualityScoreBadge({ review }: { review: ArtifactQualityReview }) {
  const statusStyle = REVIEW_STATUS_STYLES[review.review_status] ?? "bg-slate-50 text-slate-700 border-slate-200";
  const statusLabel = REVIEW_STATUS_LABELS[review.review_status] ?? review.review_status;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle}`}>
      <span className={`font-bold ${scoreColor(review.overall_score)}`}>{review.overall_score}</span>
      <span>{statusLabel}</span>
    </span>
  );
}

function QualityReportPanel({ review, artifactTitle }: { review: ArtifactQualityReview; artifactTitle: string }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const hasAttentionItems = (review.teacher_attention_needed ?? []).length > 0;
  const hasCorrections = (review.corrections_applied ?? []).length > 0;
  const hasFlags = review.flags && Object.values(review.flags).some(Boolean);
  const panelStyle = REVIEW_STATUS_STYLES[review.review_status] ?? "bg-slate-50 border-slate-200";

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${panelStyle}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">Quality Review</p>
            <QualityScoreBadge review={review} />
            {(!review.review_version || review.review_version < CURRENT_REVIEW_VERSION) ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Outdated — run Quality Review to refresh
              </span>
            ) : null}
          </div>
          {review.strengths?.length ? (
            <p className="mt-0.5 text-[11px] text-slate-600">{review.strengths[0]}</p>
          ) : null}
          {review.reviewed_at ? (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Reviewed {formatReviewedAt(review.reviewed_at)}
              {review.review_scope?.scope_note ? ` · ${review.review_scope.scope_note}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="text-xs text-slate-500 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : "Details"}
          </button>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => setDismissed(true)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Teacher attention items — always visible when present */}
      {hasAttentionItems && (
        <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700 mb-1">Teacher Action Needed</p>
          <ul className="list-disc ml-4 space-y-0.5">
            {review.teacher_attention_needed.map((item, i) => (
              <li key={i} className="text-[11px] text-rose-800">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Auto-corrections applied */}
      {hasCorrections && !expanded ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {review.corrections_applied.length} correction{review.corrections_applied.length !== 1 ? "s" : ""} applied automatically.
        </p>
      ) : null}

      {/* Expanded details */}
      {expanded ? (
        <div className="mt-3 space-y-3 text-xs">
          {/* Strengths */}
          {review.strengths?.length ? (
            <div>
              <p className="mb-1 font-semibold text-emerald-700">Strengths</p>
              <ul className="ml-3 list-disc space-y-0.5 text-emerald-800">
                {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ) : null}

          {/* Suggestions */}
          {review.suggestions?.length ? (
            <div>
              <p className="mb-1 font-semibold text-slate-700">Suggestions</p>
              <ul className="ml-3 list-disc space-y-0.5 text-slate-700">
                {review.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ) : null}

          {/* Corrections applied */}
          {hasCorrections ? (
            <div>
              <p className="mb-1 font-semibold text-sky-700">Corrections Applied</p>
              <ul className="ml-3 list-disc space-y-0.5 text-sky-800">
                {review.corrections_applied.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          ) : null}

          {/* Category scores */}
          <div>
            <p className="mb-1.5 font-semibold text-slate-700">Category Scores</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(review.categories ?? {}).map(([key, cat]) => {
                if (!cat) return null;
                const score = cat.score ?? 0;
                const findings = cat.findings ?? (cat.finding ? [cat.finding] : []);
                return (
                  <div key={key} className="flex items-start gap-1.5">
                    <span className={`shrink-0 font-bold text-[11px] w-7 text-right ${scoreColor(score)}`}>{score}</span>
                    <div>
                      <span className="text-[11px] text-slate-700">{CATEGORY_LABELS[key] ?? key}</span>
                      {findings.length > 0 && score < 90 ? (
                        <p className="text-[10px] text-slate-500 mt-0.5">{findings[0]}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active flags */}
          {hasFlags ? (
            <div className="flex flex-wrap gap-1">
              {review.flags.missing_curriculum_resource && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 font-medium">Missing Resource</span>
              )}
              {review.flags.image_review_needed && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 font-medium">Image Review</span>
              )}
              {review.flags.continuity_issue && (
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 font-medium">Continuity</span>
              )}
              {review.flags.placeholder_language && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">Placeholder Language</span>
              )}
              {review.flags.incomplete_rhythm && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">Incomplete Rhythm</span>
              )}
            </div>
          ) : null}

          {review.reviewed_at ? (
            <p className="text-[10px] text-slate-400">Reviewed: {new Date(review.reviewed_at).toLocaleString()}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Review version the frontend expects — bump when backend logic changes.
const CURRENT_REVIEW_VERSION = "2026-07-11";

// Statuses that require active teacher intervention (not just informational notes).
const NEEDS_ATTENTION_STATUSES = new Set([
  "needs_review",
  "missing_curriculum_resource",
  "continuity_review_needed",
  "image_review_needed",
]);

function formatReviewedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

function PackageQualitySummary({ artifacts }: { artifacts: InstructionalPackageArtifact[] }) {
  const reviewed = artifacts.filter((a) => a.quality_review);
  const [expanded, setExpanded] = useState(false);

  if (reviewed.length === 0) return null;

  const avgScore = Math.round(
    reviewed.reduce((sum, a) => sum + (a.quality_review!.overall_score ?? 0), 0) / reviewed.length
  );

  // Status breakdown counts
  const readyCount = reviewed.filter((a) => a.quality_review?.review_status === "ready").length;
  const readyWithNotesCount = reviewed.filter((a) => a.quality_review?.review_status === "ready_with_notes").length;
  const needsReviewCount = reviewed.filter(
    (a) => a.quality_review && NEEDS_ATTENTION_STATUSES.has(a.quality_review.review_status)
  ).length;

  const totalCorrections = reviewed.reduce(
    (sum, a) => sum + (a.quality_review?.corrections_applied?.length ?? 0), 0
  );

  // Stale detection: any artifact reviewed before the current version
  const hasStaleReviews = reviewed.some(
    (a) => !a.quality_review?.review_version || a.quality_review.review_version < CURRENT_REVIEW_VERSION
  );

  const summaryStyle = avgScore >= 90
    ? "border-emerald-200 bg-emerald-50"
    : avgScore >= 75
    ? "border-sky-200 bg-sky-50"
    : "border-amber-200 bg-amber-50";

  const statusParts: string[] = [];
  if (readyCount > 0) statusParts.push(`${readyCount} ready`);
  if (readyWithNotesCount > 0) statusParts.push(`${readyWithNotesCount} ready with notes`);
  if (needsReviewCount > 0) statusParts.push(`${needsReviewCount} need review`);

  return (
    <div className={`rounded-xl border px-3 py-3 text-sm ${summaryStyle}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="font-semibold text-slate-900">
            Instructional Quality Review
            <span className={`ml-2 text-base font-bold ${scoreColor(avgScore)}`}>{avgScore}/100</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {reviewed.length} artifact{reviewed.length !== 1 ? "s" : ""} reviewed
            {statusParts.length > 0 ? ` · ${statusParts.join(" · ")}` : ""}
            {totalCorrections > 0 ? ` · ${totalCorrections} correction${totalCorrections !== 1 ? "s" : ""} applied` : ""}
          </p>
          {hasStaleReviews ? (
            <p className="mt-0.5 text-[11px] text-amber-700">
              Some reviews were generated with an older scoring version — run Quality Review to refresh.
            </p>
          ) : null}
        </div>
        <span className="text-xs text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-1.5">
          {reviewed.map((a) => {
            const qr = a.quality_review!;
            const isStale = !qr.review_version || qr.review_version < CURRENT_REVIEW_VERSION;
            const statusStyle = REVIEW_STATUS_STYLES[qr.review_status] ?? "border-slate-200 bg-white text-slate-700";
            const reviewedDate = formatReviewedAt(qr.reviewed_at);
            return (
              <div key={a.id} className={`rounded-lg border px-2.5 py-1.5 text-xs ${statusStyle}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{a.title}</span>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`font-bold ${scoreColor(qr.overall_score)}`}>{qr.overall_score}</span>
                    <span className="text-[11px]">{REVIEW_STATUS_LABELS[qr.review_status] ?? qr.review_status}</span>
                    {isStale ? <span className="text-amber-600 text-[10px]">outdated</span> : null}
                  </div>
                </div>
                {reviewedDate ? (
                  <p className="mt-0.5 text-[10px] opacity-60">Reviewed {reviewedDate}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LessonStepSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function SubjectBlockViewer({ block }: { block: LessonPlanSubjectBlock }) {
  const [expanded, setExpanded] = useState(false);
  const preteach = block.preteach;
  const modeling = block.teacher_modeling_script;
  const hasStructure = !!(preteach || modeling || block.learning_target || block.teks_alignment?.length);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{block.subject_name || "Subject"}</p>
          {block.learning_target ? (
            <p className="mt-0.5 text-xs text-slate-600">
              <span className="font-medium">Learning Target:</span> {block.learning_target}
            </p>
          ) : null}
          {block.teks_alignment?.length ? (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {block.teks_alignment.map((t, i) => (
                <span key={i} className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                  {t.code}
                </span>
              ))}
            </div>
          ) : null}
          {block.curriculum_resource ? (
            <p className="mt-1 text-[11px] text-emerald-700">
              <span className="font-semibold">Resource:</span> {block.curriculum_resource}
            </p>
          ) : null}
        </div>
        {hasStructure ? (
          <button
            type="button"
            className="shrink-0 text-xs text-sky-600 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : "Expand lesson"}
          </button>
        ) : null}
      </div>

      {/* Completeness issues */}
      {block._completeness_issues?.length ? (
        <div className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700">
          <span className="font-semibold">Incomplete:</span> {block._completeness_issues.slice(0, 3).join(" · ")}
          {block._completeness_issues.length > 3 ? ` + ${block._completeness_issues.length - 3} more` : ""}
        </div>
      ) : null}

      {/* Resource rationale */}
      {expanded && block.resource_rationale ? (
        <p className="mt-2 text-[11px] italic text-slate-500">{block.resource_rationale}</p>
      ) : null}

      {/* 9-step rhythm */}
      {expanded ? (
        <div className="mt-3 space-y-2 text-xs text-slate-700">
          {/* Steps 1–2: Preteach */}
          {preteach ? (
            <LessonStepSection label="Preteach">
              {preteach.activate_prior_knowledge ? (
                <p><span className="font-medium">Activate:</span> {preteach.activate_prior_knowledge}</p>
              ) : null}
              {preteach.vocabulary_preview ? (
                <p className="mt-1"><span className="font-medium">Vocabulary:</span> {preteach.vocabulary_preview}</p>
              ) : null}
              {preteach.student_friendly_explanation ? (
                <p className="mt-1"><span className="font-medium">Explain:</span> {preteach.student_friendly_explanation}</p>
              ) : null}
              {preteach.why_this_matters ? (
                <p className="mt-1"><span className="font-medium">Why it matters:</span> {preteach.why_this_matters}</p>
              ) : null}
              {preteach.engagement_question ? (
                <p className="mt-1 font-medium text-sky-700">{preteach.engagement_question}</p>
              ) : null}
            </LessonStepSection>
          ) : null}

          {/* Step 4: Teacher Modeling */}
          {modeling ? (
            <LessonStepSection label="Teacher Modeling">
              {modeling.teacher_says ? (
                <p className="italic text-slate-800">&ldquo;{modeling.teacher_says}&rdquo;</p>
              ) : null}
              {modeling.students_do ? (
                <p className="mt-1"><span className="font-medium">Students do:</span> {modeling.students_do}</p>
              ) : null}
              {modeling.teacher_questions?.length ? (
                <div className="mt-1">
                  <p className="font-medium">Teacher questions:</p>
                  <ul className="ml-3 list-disc space-y-0.5">
                    {modeling.teacher_questions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              ) : null}
              {modeling.expected_student_thinking ? (
                <p className="mt-1"><span className="font-medium">Expected thinking:</span> {modeling.expected_student_thinking}</p>
              ) : null}
              {modeling.common_misconceptions?.length ? (
                <div className="mt-1">
                  <p className="font-medium text-amber-700">Common misconceptions:</p>
                  <ul className="ml-3 list-disc space-y-0.5 text-amber-700">
                    {modeling.common_misconceptions.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              ) : null}
            </LessonStepSection>
          ) : null}

          {/* Steps 5–6: Practice */}
          {block.guided_practice ? (
            <LessonStepSection label="Guided Practice">
              <p>{block.guided_practice}</p>
            </LessonStepSection>
          ) : null}
          {block.independent_practice ? (
            <LessonStepSection label="Independent Practice">
              <p>{block.independent_practice}</p>
            </LessonStepSection>
          ) : null}

          {/* Step 7: CFU */}
          {block.checks_for_understanding?.length ? (
            <LessonStepSection label="Checks for Understanding">
              <ol className="ml-3 list-decimal space-y-0.5">
                {block.checks_for_understanding.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </LessonStepSection>
          ) : null}

          {/* Step 8: Closure */}
          {block.closure ? (
            <LessonStepSection label="Closure">
              <p>{block.closure}</p>
            </LessonStepSection>
          ) : null}

          {/* Step 9: Transition */}
          {block.transition ? (
            <LessonStepSection label="Transition">
              <p className="italic text-slate-500">{block.transition}</p>
            </LessonStepSection>
          ) : null}

          {/* Teacher notes */}
          {block.notes ? (
            <LessonStepSection label="Notes">
              <p className="text-slate-500">{block.notes}</p>
            </LessonStepSection>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Slide images</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visualAssets.map((asset) => (
              <div key={asset.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs text-slate-700">
                {asset.source_url && asset.visual_generation_status === "fetched" ? (
                  <img
                    src={asset.source_url}
                    alt={asset.description || asset.title || "Slide visual"}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-20 items-center justify-center bg-slate-100 text-slate-400 text-xs">
                    {asset.visual_generation_status === "pending" ? "Fetching image…" : "Image unavailable"}
                  </div>
                )}
                <div className="p-3">
                  <p className="font-medium text-slate-900">
                    {(asset.title || asset.visual_type || "Visual").replaceAll("_", " ")}
                  </p>
                  {asset.description ? <p className="mt-1">{asset.description}</p> : null}
                  {(asset.search_terms ?? []).length > 0 ? (
                    <p className="mt-1 text-slate-500">Search: {asset.search_terms?.join(", ")}</p>
                  ) : null}
                  {asset.attribution ? (
                    <p className="mt-1 text-slate-400">© {asset.attribution}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* Quality review panel — shown when a review is attached to this artifact */}
      {artifact.quality_review ? (
        <div className="mb-3">
          <QualityReportPanel review={artifact.quality_review} artifactTitle={artifact.title} />
        </div>
      ) : null}

      {/* Structured lesson plan viewer for daily_lesson_plan artifacts */}
      {artifact.artifact_type === "daily_lesson_plan" &&
       Array.isArray(artifact.content_json?.subjects) &&
       (artifact.content_json.subjects as LessonPlanSubjectBlock[]).some(
         (b) => b.preteach || b.teacher_modeling_script || b.learning_target
       ) ? (
        <div className="mb-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Structured Lesson View</p>
          {(artifact.content_json.subjects as LessonPlanSubjectBlock[]).map((block, i) => (
            <SubjectBlockViewer key={i} block={block} />
          ))}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDayLabel(artifact.day_label)}</p>
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
  const { setProcessingIndicator, clearProcessingIndicator, context } = useTeacherAssistV2();
  const packageId = packageIdProp ?? searchParams.get("id") ?? "";
  const showPendingConfirmation = searchParams.get("pending") === "1";
  const isDevUser = context?.role === "root_admin";
  const [detail, setDetail] = useState<InstructionalPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const [showCloseOut, setShowCloseOut] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [confirmTeachingDone, setConfirmTeachingDone] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devTab, setDevTab] = useState<"pipeline" | "artifacts" | "cost" | "regen">("pipeline");
  const [imageFetchLoading, setImageFetchLoading] = useState(false);
  const [imageFetchResult, setImageFetchResult] = useState<string | null>(null);
  const [regenScope, setRegenScope] = useState("full");
  const [regenArtifactTypes, setRegenArtifactTypes] = useState<string[]>([]);
  const [regenLoading, setRegenLoading] = useState(false);
  const [devLockedIds, setDevLockedIds] = useState<Set<string>>(new Set());
  const [lockingId, setLockingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const isInitialLoad = !detail;
    if (isInitialLoad) {
      setLoading(true);
    }
    if (isInitialLoad) setError(null);
    try {
      const next = await fetchV2InstructionalPackage(packageId);
      setDetail(next);
      if (!isInitialLoad) setError(null);
    } catch (nextError) {
      const msg = nextError instanceof Error ? nextError.message : "Package not found.";
      const isNetworkError = msg.includes("Could not reach API") || msg.includes("ERR_");
      // Only surface errors on initial load or non-transient errors (404, etc.).
      // Suppress transient network errors during background refresh so a brief
      // connection blip doesn't replace the loaded package view with an error.
      if (isInitialLoad || !isNetworkError) {
        setError(msg);
      }
      // Package no longer exists — clear any stale processing indicator for it
      // so it doesn't persist in sessionStorage across page loads.
      if (!isNetworkError) {
        clearProcessingIndicator(packageId);
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, [clearProcessingIndicator, detail, packageId]);

  useEffect(() => {
    if (!packageId) return;
    void refresh();
  }, [packageId, refresh]);

  // Sync dev-lock state from the loaded detail whenever it changes.
  useEffect(() => {
    if (!detail?.artifacts) return;
    setDevLockedIds(new Set(detail.artifacts.filter((a) => a.dev_locked).map((a) => a.id)));
  }, [detail?.artifacts]);

  useEffect(() => {
    if (detail?.status !== "processing") return;
    let consecutiveErrors = 0;
    const timer = window.setInterval(() => {
      void (async () => {
        const status = await pollV2PackageStatus(packageId);
        if (status === "auth_error" || status === "not_found") {
          window.clearInterval(timer);
          if (status === "not_found") {
            setDetail(null);
            setError("This package is no longer available.");
          }
          return;
        }
        if (status === null) {
          consecutiveErrors += 1;
          if (consecutiveErrors >= 5) window.clearInterval(timer);
          return;
        }
        consecutiveErrors = 0;
        if (status !== "processing") void refresh();
      })();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [detail?.status, packageId, refresh, setDetail, setError]);

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
          {detail.total_planned_days != null && detail.total_curriculum_days != null ? (
            <span className="ml-2 text-slate-500">
              ·{" "}
              <span className="font-medium text-slate-700">{detail.total_planned_days}</span>
              {" of "}
              {detail.total_curriculum_days} instructional days
              {detail.lost_instructional_days ? (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {detail.lost_instructional_days} lost
                </span>
              ) : null}
            </span>
          ) : null}
        </p>
        <p
          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[detail.status] ?? "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {detail.status.replaceAll("_", " ")}
        </p>
        {(detail.generation_started_at || detail.generation_completed_at || detail.generation_duration_seconds != null) ? (
          <p className="mt-1 text-xs text-slate-400">
            {detail.generation_started_at ? (
              <span>Started {new Date(detail.generation_started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            ) : null}
            {detail.generation_completed_at ? (
              <span>{detail.generation_started_at ? " · " : ""}Completed {new Date(detail.generation_completed_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            ) : null}
            {(() => {
              // Prefer computing duration from the two displayed timestamps so the math is always consistent.
              const durSec = (detail.generation_started_at && detail.generation_completed_at)
                ? Math.round((new Date(detail.generation_completed_at).getTime() - new Date(detail.generation_started_at).getTime()) / 1000)
                : detail.generation_duration_seconds;
              if (durSec == null) return null;
              const label = durSec >= 3600
                ? `${Math.floor(durSec / 3600)}h ${Math.floor((durSec % 3600) / 60)}m`
                : durSec >= 60
                  ? `${Math.floor(durSec / 60)}m ${Math.round(durSec % 60)}s`
                  : `${Math.round(durSec)}s`;
              return <span>{(detail.generation_started_at || detail.generation_completed_at) ? " · " : ""}{label}</span>;
            })()}
          </p>
        ) : null}
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
      <PackageQualitySummary artifacts={detail.artifacts ?? []} />
      <LearningJourneyPanel
        journeys={detail.strand_learning_journeys}
        weekStart={detail.week_start}
        weekEnd={detail.week_end}
      />
      <StrategyVarietyCard artifacts={detail.artifacts ?? []} />
      {detail.curriculum_resource_alignment ? (
        <CurriculumResourceAlignmentCard alignment={detail.curriculum_resource_alignment} />
      ) : null}
      {detail.instructional_delivery_profile && detail.instructional_delivery_profile.mode !== "ai_optimized" ? (
        <ClassroomInstructionProfileCard profile={detail.instructional_delivery_profile} />
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

      {isDevUser && (() => {
        const manifest = detail.generation_manifest;
        const isLegacyManifest = manifest?.pipeline_schema_version === "legacy";
        const allArtifacts = detail.artifacts ?? [];
        // Per-artifact cost and token aggregates by type
        const costByType: Record<string, number> = {};
        const tokensByType: Record<string, { input: number; output: number }> = {};
        for (const a of allArtifacts) {
          const prov = a.generation_provenance;
          if (prov) {
            costByType[a.artifact_type] = (costByType[a.artifact_type] ?? 0) + (prov.estimated_cost_cents ?? 0);
            tokensByType[a.artifact_type] = {
              input: (tokensByType[a.artifact_type]?.input ?? 0) + (prov.input_tokens ?? 0),
              output: (tokensByType[a.artifact_type]?.output ?? 0) + (prov.output_tokens ?? 0),
            };
          }
        }
        // All artifact types present in this package
        const presentTypes = [...new Set(allArtifacts.map((a) => a.artifact_type))].sort();

        const sourceIcon = (src: string | undefined, locked: boolean) => {
          if (locked) return <span title="Locked" className="text-violet-500">⏸</span>;
          if (src === "ai") return <span title="AI generated" className="text-emerald-600">✓</span>;
          if (src === "deterministic") return <span title="Deterministic" className="text-amber-500">≡</span>;
          if (src === "cached") return <span title="Cached" className="text-sky-500">◎</span>;
          return <span className="text-slate-400">?</span>;
        };

        return (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/40 text-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-violet-900"
              onClick={() => setDevPanelOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <span className="rounded bg-violet-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                  Dev
                </span>
                Developer Mode
                {devLockedIds.size > 0 && (
                  <span className="rounded-full bg-violet-300 px-1.5 py-0.5 text-[10px] font-bold text-violet-900">
                    {devLockedIds.size} locked
                  </span>
                )}
              </span>
              <span className="text-violet-500">{devPanelOpen ? "▲" : "▼"}</span>
            </button>

            {devPanelOpen && (
              <div className="border-t border-violet-200">
                {/* Tab bar */}
                <div className="flex gap-0 border-b border-violet-200 px-4">
                  {(["pipeline", "artifacts", "cost", "regen"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDevTab(tab)}
                      className={`-mb-px border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                        devTab === tab
                          ? "border-violet-600 text-violet-700"
                          : "border-transparent text-violet-400 hover:text-violet-600"
                      }`}
                    >
                      {tab === "pipeline" ? "Pipeline" : tab === "artifacts" ? "Artifacts" : tab === "cost" ? "Cost" : "Regenerate"}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {/* ── Pipeline tab ─────────────────────────────────────────── */}
                  {devTab === "pipeline" && (
                    <div>
                      {manifest && !isLegacyManifest ? (
                        <>
                          <div className="mb-4 flex flex-wrap gap-3 text-xs">
                            <span className="text-violet-700">
                              Mode: <span className="font-semibold">{manifest.generation_mode}</span>
                            </span>
                            <span className="text-violet-700">
                              Schema: <span className="font-mono">{manifest.pipeline_schema_version}</span>
                            </span>
                            <span className="font-mono text-[10px] text-violet-400">
                              plan:{manifest.planning_hash}
                            </span>
                          </div>

                          {/* Tier 1 pipeline stages */}
                          <div className="mb-4">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-600">Tier 1 — Planning Pipeline</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: "Curriculum Parsing", layer: "curriculum" },
                                { label: "Resource Bank", layer: "curriculum" },
                                { label: "Instructional Design", layer: "planning" },
                                { label: "Strand Journeys", layer: "planning" },
                              ].map(({ label, layer }) => {
                                const hit = manifest.cache_layer_hits?.[layer];
                                return (
                                  <div
                                    key={label}
                                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                                      hit
                                        ? "border-sky-200 bg-sky-50 text-sky-700"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    <span>{hit ? "◎" : "✓"}</span>
                                    <span className="font-medium">{label}</span>
                                    <span className="text-[9px] opacity-60">{hit ? "cached" : "generated"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Tier 2 artifact types summary */}
                          <div>
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-600">Tier 2 — Artifacts</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(manifest.artifact_source_counts).map(([atype, counts]) => {
                                const hasLocked = allArtifacts.some(
                                  (a) => a.artifact_type === atype && devLockedIds.has(a.id),
                                );
                                return (
                                  <div
                                    key={atype}
                                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                                      hasLocked
                                        ? "border-violet-200 bg-violet-50 text-violet-700"
                                        : counts.ai > 0
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    <span>{hasLocked ? "⏸" : counts.ai > 0 ? "✓" : "≡"}</span>
                                    <span className="font-mono text-[10px]">{atype}</span>
                                    {hasLocked && <span className="text-[9px] opacity-70">locked</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-violet-600">
                            {isLegacyManifest
                              ? "Pipeline tracking not available for this package — it was generated before pipeline instrumentation was added. Cost data is shown in the Cost tab. Regenerate to enable full pipeline tracking."
                              : "No generation manifest — this package was generated before pipeline tracking was added. Regenerate to populate Pipeline and Cost data."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={imageFetchLoading}
                              onClick={async () => {
                                setImageFetchLoading(true);
                                setImageFetchResult(null);
                                try {
                                  const r = await triggerPackageImageFetch(packageId);
                                  setImageFetchResult(`Re-fetched images for ${r.artifacts_processed} artifact(s)${r.artifacts_failed > 0 ? `, ${r.artifacts_failed} failed` : ""}.`);
                                  void refresh();
                                } catch {
                                  setImageFetchResult("Image fetch failed.");
                                } finally {
                                  setImageFetchLoading(false);
                                }
                              }}
                              className="rounded bg-violet-100 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-200 disabled:opacity-40"
                            >
                              {imageFetchLoading ? "Fetching…" : "Re-fetch Images"}
                            </button>
                          </div>
                          {imageFetchResult && (
                            <p className="text-[11px] text-violet-700">{imageFetchResult}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Artifacts tab ─────────────────────────────────────────── */}
                  {devTab === "artifacts" && (
                    <div>
                      <p className="mb-3 text-[11px] text-violet-600">
                        Lock an artifact to preserve it across regenerations. Locked types are skipped entirely when included in a regen request.
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-violet-200 bg-white">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-violet-100 bg-violet-50 text-left text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                              <th className="px-3 py-2">Artifact</th>
                              <th className="px-3 py-2">Day</th>
                              <th className="px-3 py-2">Source</th>
                              <th className="px-3 py-2">Prompt</th>
                              <th className="px-3 py-2">Generated</th>
                              <th className="px-3 py-2">Lock</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allArtifacts.map((artifact) => {
                              const isLocked = devLockedIds.has(artifact.id);
                              const prov = artifact.generation_provenance;
                              return (
                                <tr
                                  key={artifact.id}
                                  className={`border-b border-slate-100 last:border-0 ${isLocked ? "bg-violet-50/60" : ""}`}
                                >
                                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-700">
                                    {artifact.artifact_type}
                                    {artifact.subject_name && (
                                      <span className="ml-1 text-slate-400">· {artifact.subject_name}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-500">{artifact.day_label ?? "—"}</td>
                                  <td className="px-3 py-1.5">
                                    {sourceIcon(prov?.generation_source, isLocked)}
                                    {prov && !isLocked && (
                                      <span className="ml-1 text-[10px] text-slate-500">{prov.generation_source}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">
                                    {prov?.prompt_version ?? "—"}
                                  </td>
                                  <td className="px-3 py-1.5 text-[10px] text-slate-400">
                                    {prov?.generated_at
                                      ? new Date(prov.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <button
                                      type="button"
                                      disabled={lockingId === artifact.id}
                                      title={isLocked ? "Unlock artifact" : "Lock artifact"}
                                      className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                        isLocked
                                          ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                      } disabled:opacity-40`}
                                      onClick={async () => {
                                        setLockingId(artifact.id);
                                        const nextLocked = !isLocked;
                                        // Optimistic update
                                        setDevLockedIds((prev) => {
                                          const next = new Set(prev);
                                          if (nextLocked) next.add(artifact.id);
                                          else next.delete(artifact.id);
                                          return next;
                                        });
                                        try {
                                          await setArtifactDevLock(artifact.id, nextLocked);
                                        } catch {
                                          // Rollback optimistic update on error
                                          setDevLockedIds((prev) => {
                                            const next = new Set(prev);
                                            if (nextLocked) next.delete(artifact.id);
                                            else next.add(artifact.id);
                                            return next;
                                          });
                                        } finally {
                                          setLockingId(null);
                                        }
                                      }}
                                    >
                                      {lockingId === artifact.id ? "…" : isLocked ? "⏸ Locked" : "Lock"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Cost tab ──────────────────────────────────────────────── */}
                  {devTab === "cost" && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">Cost by Feature</p>
                        {manifest && (
                          <span className="text-xs font-semibold text-violet-800">
                            Total: ${(manifest.total_generation_cost_cents / 100).toFixed(3)}
                          </span>
                        )}
                      </div>
                      <div className="mb-4 overflow-x-auto rounded-lg border border-violet-200 bg-white">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-violet-100 bg-violet-50 text-left text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                              <th className="px-3 py-2">Feature / Artifact Type</th>
                              <th className="px-3 py-2">Cost</th>
                              <th className="px-3 py-2">In tokens</th>
                              <th className="px-3 py-2">Out tokens</th>
                              <th className="px-3 py-2">Prompt ver</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Tier-1 pipeline costs from manifest */}
                            {manifest && Object.entries(manifest.cost_cents_by_feature)
                              .filter(([f]) => !presentTypes.includes(f))
                              .sort(([, a], [, b]) => b - a)
                              .map(([feature, cents]) => (
                                <tr key={feature} className="border-b border-slate-100 bg-slate-50/40 last:border-0">
                                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">{feature}</td>
                                  <td className="px-3 py-1.5 text-slate-600">${(cents / 100).toFixed(3)}</td>
                                  <td className="px-3 py-1.5 text-slate-400">—</td>
                                  <td className="px-3 py-1.5 text-slate-400">—</td>
                                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">
                                    {manifest.prompt_versions_used?.[feature] ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            {/* Per-artifact type costs from provenance */}
                            {presentTypes
                              .filter((t) => costByType[t] !== undefined || tokensByType[t] !== undefined)
                              .sort((a, b) => (costByType[b] ?? 0) - (costByType[a] ?? 0))
                              .map((atype) => (
                                <tr key={atype} className="border-b border-slate-100 last:border-0">
                                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-700">{atype}</td>
                                  <td className="px-3 py-1.5 text-slate-600">
                                    {costByType[atype] !== undefined ? `$${(costByType[atype] / 100).toFixed(3)}` : "—"}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-500">
                                    {tokensByType[atype]?.input?.toLocaleString() ?? "—"}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-500">
                                    {tokensByType[atype]?.output?.toLocaleString() ?? "—"}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">
                                    {manifest?.prompt_versions_used?.[atype] ?? "—"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      {manifest && Object.keys(manifest.artifact_source_counts).length > 0 && (
                        <>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                            Generation Source Counts
                          </p>
                          <div className="overflow-x-auto rounded-lg border border-violet-200 bg-white">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-violet-100 bg-violet-50 text-left text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                                  <th className="px-3 py-2">Type</th>
                                  <th className="px-3 py-2 text-emerald-600">AI</th>
                                  <th className="px-3 py-2 text-amber-600">Det.</th>
                                  <th className="px-3 py-2 text-sky-600">Cached</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(manifest.artifact_source_counts).map(([atype, counts]) => (
                                  <tr key={atype} className="border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-1.5 font-mono text-[10px] text-slate-700">{atype}</td>
                                    <td className="px-3 py-1.5 text-emerald-700">{counts.ai || 0}</td>
                                    <td className="px-3 py-1.5 text-amber-700">{counts.deterministic || 0}</td>
                                    <td className="px-3 py-1.5 text-sky-700">{counts.cached || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Regenerate tab ────────────────────────────────────────── */}
                  {devTab === "regen" && (
                    <div>
                      {devLockedIds.size > 0 && (
                        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] text-violet-700">
                          <span className="font-semibold">{devLockedIds.size} artifact{devLockedIds.size !== 1 ? "s" : ""} locked.</span>
                          {" "}Locked types are skipped even if selected below. Unlock in the Artifacts tab.
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                          Scope
                        </label>
                        <select
                          className="rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-xs text-slate-800"
                          value={regenScope}
                          onChange={(e) => {
                            setRegenScope(e.target.value);
                            setRegenArtifactTypes([]);
                          }}
                        >
                          <option value="full">Full — regenerate everything</option>
                          <option value="quality_review">Quality review only</option>
                          <option value="artifact_types">Selected artifact types</option>
                        </select>
                      </div>

                      {regenScope === "artifact_types" && (
                        <div className="mb-3">
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                            Artifact types to regenerate
                          </label>
                          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                            {presentTypes.map((atype) => {
                              const hasLocked = allArtifacts.some(
                                (a) => a.artifact_type === atype && devLockedIds.has(a.id),
                              );
                              const checked = regenArtifactTypes.includes(atype);
                              return (
                                <label
                                  key={atype}
                                  className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${
                                    hasLocked
                                      ? "cursor-not-allowed opacity-40"
                                      : checked
                                      ? "bg-violet-100 text-violet-800"
                                      : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={hasLocked}
                                    checked={checked}
                                    onChange={(e) =>
                                      setRegenArtifactTypes((prev) =>
                                        e.target.checked
                                          ? [...prev, atype]
                                          : prev.filter((t) => t !== atype),
                                      )
                                    }
                                    className="accent-violet-600"
                                  />
                                  <span className="font-mono">{atype}</span>
                                  {hasLocked && <span className="text-violet-400">⏸</span>}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={
                            regenLoading ||
                            detail.status === "processing" ||
                            (regenScope === "artifact_types" && regenArtifactTypes.length === 0)
                          }
                          className="ta-button-primary h-8 px-4 text-xs disabled:opacity-50"
                          onClick={async () => {
                            setRegenLoading(true);
                            try {
                              await triggerV2PackageRegen(packageId, {
                                scope: regenScope,
                                artifact_types:
                                  regenScope === "artifact_types" ? regenArtifactTypes : undefined,
                              });
                              void refresh();
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "Regeneration failed");
                            } finally {
                              setRegenLoading(false);
                            }
                          }}
                        >
                          {regenLoading ? "Queuing…" : "Regenerate"}
                        </button>
                        <button
                          type="button"
                          disabled={imageFetchLoading}
                          onClick={async () => {
                            setImageFetchLoading(true);
                            setImageFetchResult(null);
                            try {
                              const r = await triggerPackageImageFetch(packageId);
                              setImageFetchResult(`Re-fetched images for ${r.artifacts_processed} artifact(s)${r.artifacts_failed > 0 ? `, ${r.artifacts_failed} failed` : ""}.`);
                              void refresh();
                            } catch {
                              setImageFetchResult("Image fetch failed.");
                            } finally {
                              setImageFetchLoading(false);
                            }
                          }}
                          className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40"
                        >
                          {imageFetchLoading ? "Fetching…" : "Re-fetch Images"}
                        </button>
                      </div>
                      {imageFetchResult && (
                        <p className="mt-2 text-[11px] text-violet-700">{imageFetchResult}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}
