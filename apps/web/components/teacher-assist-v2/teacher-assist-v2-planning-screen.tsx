"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TeacherAssistV2AiModeBanner } from "@/components/teacher-assist-v2/teacher-assist-v2-ai-mode-banner";
import { TeacherAssistV2ConfirmModal } from "@/components/teacher-assist-v2/teacher-assist-v2-confirm-modal";
import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import {
  ApiFieldErrors,
  createV2PlanningSupplementalLink,
  createV2PlanningSupplementalNote,
  extractV2PlanningSupplementalFile,
  fetchV2PlanningForm,
  fetchV2PlanningReview,
  generateV2InstructionalPackage,
  uploadV2PlanningSupplementalFile,
} from "@/lib/teacher-assist-v2-api";
import type {
  PacingGuideSupportingMaterial,
  PlanningForm,
  PlanningReview,
  PlanningSupplementalMaterial,
} from "@/lib/teacher-assist-v2-types";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

type DeliveryMode = "ai_optimized" | "daily_balanced" | "block_schedule";

type DeliveryStrand = {
  strand_name: string;
  minutes_per_day: string; // string for input control; converted to number on submit
  days: Weekday[];
  // Classroom Instruction Profile (CIP) fields
  delivery_mode: string;
  curriculum_text_access: string;
  independent_reading_access: string;
  closure_required: boolean;
};

const READING_DELIVERY_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "— not set —" },
  { value: "teacher_read_aloud", label: "Teacher Read Aloud" },
  { value: "shared_reading", label: "Shared Reading" },
  { value: "students_have_individual_copies", label: "Student Individual Copies" },
  { value: "small_group_reading", label: "Small Group" },
  { value: "independent_reading", label: "Independent Reading" },
  { value: "teacher_choice", label: "Teacher Choice" },
];

const WRITING_DELIVERY_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "— not set —" },
  { value: "guided_writing", label: "Guided Writing" },
  { value: "independent_writing", label: "Independent Writing" },
  { value: "shared_writing", label: "Shared Writing" },
  { value: "teacher_choice", label: "Teacher Choice" },
];

const CURRICULUM_TEXT_ACCESS_OPTIONS: Array<{ value: string; label: string; hint?: string }> = [
  { value: "", label: "— not set —" },
  { value: "teacher_copy_only", label: "Teacher Copy Only", hint: "Only you have the text — students listen to your read-aloud" },
  { value: "projected_shared_display", label: "Projected / Shared Display", hint: "Text shown on projector or smartboard" },
  { value: "class_set", label: "Class Set", hint: "Every student has their own copy" },
  { value: "small_group_sets", label: "Small Group Sets", hint: "Copies rotate through small groups" },
  { value: "digital_student_access", label: "Digital (student devices)", hint: "Students access text on their own devices" },
  { value: "student_choice_text", label: "Student Choice", hint: "No single curriculum text — students choose their own" },
];

const INDEPENDENT_READING_ACCESS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "— not set —" },
  { value: "classroom_library_available", label: "Classroom Library" },
  { value: "school_library_available", label: "School Library Books" },
  { value: "student_brought_books", label: "Student-Brought Books" },
  { value: "digital_library", label: "Digital Library (Epic, Sora, etc.)" },
  { value: "none", label: "None / Not applicable" },
];

function deliveryModeOptionsForStrand(strandName: string): Array<{ value: string; label: string }> {
  const lower = strandName.toLowerCase();
  if (/writing/.test(lower)) return WRITING_DELIVERY_MODE_OPTIONS;
  return READING_DELIVERY_MODE_OPTIONS;
}

function buildDefaultStrands(subjectNames: string[]): DeliveryStrand[] {
  const hasEla = subjectNames.some((n) => /\bela\b|\benglish\b/i.test(n));
  if (hasEla) {
    return [
      {
        strand_name: "Reading",
        minutes_per_day: "35",
        days: [...WEEKDAYS],
        delivery_mode: "",
        curriculum_text_access: "",
        independent_reading_access: "",
        closure_required: false,
      },
      {
        strand_name: "Writing",
        minutes_per_day: "35",
        days: [...WEEKDAYS],
        delivery_mode: "",
        curriculum_text_access: "",
        independent_reading_access: "",
        closure_required: false,
      },
    ];
  }
  return [{ strand_name: "", minutes_per_day: "", days: [...WEEKDAYS], delivery_mode: "", curriculum_text_access: "", independent_reading_access: "", closure_required: false }];
}

const DELIVERY_MODES: Array<{ id: DeliveryMode; label: string; description: string }> = [
  {
    id: "ai_optimized",
    label: "AI Optimized",
    description: "TeacherAssist decides how to distribute instruction across the week. Best when your schedule is flexible.",
  },
  {
    id: "daily_balanced",
    label: "Daily Balanced",
    description: "Every strand is taught every day. You set how many minutes each strand receives.",
  },
  {
    id: "block_schedule",
    label: "Block Schedule",
    description: "Strands alternate by day. You choose which days each strand is taught.",
  },
];

const OPTIONAL_OUTPUTS = [
  { id: "assignment", label: "Assignments" },
  { id: "writing_response", label: "Writing Response Pages" },
  { id: "quiz", label: "Quizzes" },
  { id: "rubric", label: "Rubrics" },
  { id: "exit_ticket", label: "Exit tickets" },
  { id: "bell_ringer", label: "Bell ringers" },
  { id: "vocabulary_list", label: "Vocabulary list" },
  { id: "study_guide", label: "Study guide" },
  { id: "parent_newsletter_summary", label: "Parent newsletter summary" },
];

type StepAlert = { tone: "success" | "error"; message: string } | null;

export function TeacherAssistV2PlanningScreen() {
  const router = useRouter();
  const { context, setProcessingIndicator } = useTeacherAssistV2();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PlanningForm | null>(null);
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(1);
  const [review, setReview] = useState<PlanningReview | null>(null);
  const [teachingOrder, setTeachingOrder] = useState<string[]>([]);
  const [optionalOutputs, setOptionalOutputs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<StepAlert>(null);
  const [generating, setGenerating] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planEndDate, setPlanEndDate] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [excludedPacingMaterialIds, setExcludedPacingMaterialIds] = useState<string[]>([]);
  const [materialToRemove, setMaterialToRemove] = useState<PacingGuideSupportingMaterial | null>(null);
  const [extractingMaterialId, setExtractingMaterialId] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("ai_optimized");
  const [deliveryStrands, setDeliveryStrands] = useState<DeliveryStrand[]>([
    { strand_name: "", minutes_per_day: "", days: [...WEEKDAYS], delivery_mode: "", curriculum_text_access: "", independent_reading_access: "", closure_required: false },
  ]);
  const [lostInstructionalDays, setLostInstructionalDays] = useState(0);
  const [qualityReviewEnabled, setQualityReviewEnabled] = useState(false);

  const districtMaterials = useMemo(() => {
    if (!review) return [];
    const grouped = new Map<string, { subjectName: string; materials: PacingGuideSupportingMaterial[] }>();
    for (const week of review.weeks) {
      for (const subject of week.subjects) {
        const existing = grouped.get(subject.subject_id) ?? {
          subjectName: subject.subject_name,
          materials: [],
        };
        const seen = new Set(existing.materials.map((item) => item.id));
        for (const material of subject.district_materials) {
          if (excludedPacingMaterialIds.includes(material.id) || seen.has(material.id)) continue;
          existing.materials.push(material);
          seen.add(material.id);
        }
        grouped.set(subject.subject_id, existing);
      }
    }
    return Array.from(grouped.entries()).map(([subjectId, value]) => ({
      subjectId,
      subjectName: value.subjectName,
      materials: value.materials,
    }));
  }, [review, excludedPacingMaterialIds]);

  const weekLabel = useMemo(() => {
    if (weekStart === weekEnd) return `Week ${weekStart}`;
    return `Weeks ${weekStart}–${weekEnd}`;
  }, [weekStart, weekEnd]);

  const totalCurriculumDays = (weekEnd - weekStart + 1) * 5;
  const totalPlannedDays = Math.max(1, totalCurriculumDays - lostInstructionalDays);

  useEffect(() => {
    void fetchV2PlanningForm()
      .then((payload) => {
        setForm(payload);
        setTeachingOrder(payload.default_teaching_order);
        setOptionalOutputs(payload.recommended_outputs ?? ["quiz", "parent_newsletter_summary"]);
        setDeliveryStrands(buildDefaultStrands(payload.subjects.map((s) => s.subject_name)));
        const defaultRange = payload.week_ranges[payload.week_ranges.length - 1] ?? payload.week_ranges[0];
        if (defaultRange) {
          setWeekStart(defaultRange.week_start);
          setWeekEnd(defaultRange.week_end);
        }
        setPlanStartDate(payload.default_plan_start_date);
        setPlanEndDate(payload.default_plan_end_date);
      })
      .catch((error: Error) => setAlert({ tone: "error", message: error.message }))
      .finally(() => setLoading(false));
  }, []);

  const loadReview = async (start: number, end: number) => {
    const payload = await fetchV2PlanningReview(start, end);
    setReview(payload);
    setPlanStartDate(payload.default_plan_start_date);
    setPlanEndDate(payload.default_plan_end_date);
    setExpandedWeeks(Object.fromEntries(payload.weeks.map((week) => [week.sequence_number, true])));
  };

  const goToStep = async (nextStep: number) => {
    setAlert(null);
    if (nextStep >= 2) {
      try {
        await loadReview(weekStart, weekEnd);
      } catch (error) {
        setAlert({ tone: "error", message: error instanceof Error ? error.message : "Could not load pacing content." });
        return;
      }
    }
    setStep(nextStep);
  };

  const moveSubject = (index: number, direction: -1 | 1) => {
    setTeachingOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const uploadFiles = async (files: File[]) => {
    setAlert(null);
    try {
      for (const file of files) {
        await uploadV2PlanningSupplementalFile(file, {
          week_start: weekStart,
          week_end: weekEnd,
          title: file.name,
          resource_type: "worksheet",
        });
      }
      await loadReview(weekStart, weekEnd);
      setAlert({ tone: "success", message: "Supplemental file uploaded." });
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof ApiFieldErrors ? Object.values(error.fieldErrors).join(" ") : error instanceof Error ? error.message : "Upload failed.",
      });
    }
  };

  const addLink = async () => {
    setAlert(null);
    try {
      await createV2PlanningSupplementalLink({
        week_start: weekStart,
        week_end: weekEnd,
        title: linkTitle.trim(),
        external_url: linkUrl.trim(),
        resource_type: "reference_link",
      });
      setLinkTitle("");
      setLinkUrl("");
      await loadReview(weekStart, weekEnd);
      setAlert({ tone: "success", message: "Reference link added." });
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof ApiFieldErrors ? Object.values(error.fieldErrors).join(" ") : error instanceof Error ? error.message : "Could not add link.",
      });
    }
  };

  const addNote = async () => {
    setAlert(null);
    try {
      await createV2PlanningSupplementalNote({
        week_start: weekStart,
        week_end: weekEnd,
        note_body: noteBody.trim(),
      });
      setNoteBody("");
      await loadReview(weekStart, weekEnd);
      setAlert({ tone: "success", message: "Teacher note added." });
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not add note.",
      });
    }
  };

  const extractSupplemental = async (materialId: string) => {
    setExtractingMaterialId(materialId);
    setAlert(null);
    try {
      await extractV2PlanningSupplementalFile(materialId);
      await loadReview(weekStart, weekEnd);
      setAlert({ tone: "success", message: "File text extracted." });
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not extract file text.",
      });
    } finally {
      setExtractingMaterialId(null);
    }
  };

  const generatePackage = async () => {
    setGenerating(true);
    setAlert(null);
    try {
      const deliveryProfile =
        deliveryMode === "ai_optimized"
          ? null
          : {
              mode: deliveryMode,
              strands: deliveryStrands
                .filter((s) => s.strand_name.trim())
                .map((s) => ({
                  strand_name: s.strand_name.trim(),
                  ...(s.minutes_per_day ? { minutes_per_day: parseInt(s.minutes_per_day, 10) } : {}),
                  days: s.days,
                  ...(s.delivery_mode ? { delivery_mode: s.delivery_mode } : {}),
                  ...(s.curriculum_text_access ? { curriculum_text_access: s.curriculum_text_access } : {}),
                  ...(s.independent_reading_access ? { independent_reading_access: s.independent_reading_access } : {}),
                  ...(s.closure_required ? { closure_required: true } : {}),
                })),
            };
      const payload = await generateV2InstructionalPackage({
        week_start: weekStart,
        week_end: weekEnd,
        teaching_order: teachingOrder,
        selected_outputs: ["daily_lesson_plan", "subject_slide_deck", ...optionalOutputs],
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        excluded_pacing_material_ids: excludedPacingMaterialIds,
        instructional_delivery_profile: deliveryProfile,
        lost_instructional_days: lostInstructionalDays,
        quality_review_enabled: qualityReviewEnabled,
      });
      setProcessingIndicator({
        kind: "package",
        targetId: payload.id,
        label: "Instructional package processing",
      });
      router.push(`/teacher-assist-v2/packages/view?id=${encodeURIComponent(payload.id)}&pending=1`);
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : "Generation failed.",
      });
      setGenerating(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-600">Loading planning workspace...</p>;
  if (!form) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {alert?.message ?? "Could not load planning form."}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Weekly planning</h1>
        <p className="mt-1 text-sm text-slate-600">
          Build an instructional package from your adopted pacing guides for <strong>{weekLabel}</strong>.
        </p>
        <p className="mt-1 text-xs text-slate-500">Step {step} of 5</p>
      </header>

      <TeacherAssistV2AiModeBanner status={context?.ai_generation} />

      {alert ? (
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            alert.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {alert.message}
        </div>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Planning context</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">School year</span>
              <input className="ta-input h-9 bg-slate-50" readOnly value={form.school_year.title} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Week range</span>
              <select
                className="ta-input h-9"
                value={`${weekStart}:${weekEnd}`}
                onChange={(event) => {
                  const [start, end] = event.target.value.split(":").map(Number);
                  setWeekStart(start);
                  setWeekEnd(end);
                  setExcludedPacingMaterialIds([]);
                }}
              >
                {form.week_ranges.map((range) => (
                  <option key={`${range.week_start}-${range.week_end}`} value={`${range.week_start}:${range.week_end}`}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Subjects and pacing guides</p>
              <Link href="/teacher-assist-v2/pacing-guide-setup" className="text-xs font-semibold text-sky-700">
                Change pacing guides
              </Link>
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {form.subjects.map((subject) => (
                <li key={subject.subject_id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-slate-900">{subject.subject_name}</span>
                  <span className="text-slate-500"> — {subject.pacing_guide_title}</span>
                  {subject.available_pacing_guides && subject.available_pacing_guides.length > 1 ? (
                    <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                      {subject.available_pacing_guides.map((guide) => (
                        <li key={guide.id}>
                          {guide.is_selected ? "● " : "○ "}
                          {guide.title}
                          {guide.scope_label ? ` (${guide.scope_label})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="ta-button-primary h-9 px-4 text-sm" onClick={() => void goToStep(2)}>
            Review pacing content
          </button>
        </section>
      ) : null}

      {step === 2 && review ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Pacing guide content — {weekLabel}</h2>
          {review.weeks.map((week) => (
            <article key={week.sequence_number} className="rounded-xl border border-slate-200">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() =>
                  setExpandedWeeks((current) => ({
                    ...current,
                    [week.sequence_number]: !current[week.sequence_number],
                  }))
                }
              >
                <div>
                  <p className="font-medium text-slate-900">{week.title}</p>
                  <p className="text-xs text-slate-500">
                    {week.start_date && week.end_date ? `${week.start_date} – ${week.end_date}` : "Date range unavailable"}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{expandedWeeks[week.sequence_number] ? "Hide" : "Show"}</span>
              </button>
              {expandedWeeks[week.sequence_number] ? (
                <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                  {week.subjects.map((subject) => (
                    <div key={`${week.sequence_number}-${subject.subject_id}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-900">{subject.subject_name}</p>
                      {subject.pacing_days?.length ? (
                        <ul className="mt-2 space-y-2">
                          {subject.pacing_days.map((day) => (
                            <li key={`${subject.subject_id}-${day.day_label}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{day.day_label}</p>
                              {day.daily_topic ? <p className="mt-1 font-medium text-slate-900">{day.daily_topic}</p> : null}
                              {day.objective_focus ? (
                                <p className="mt-1 text-xs text-slate-600">Objective: {day.objective_focus}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : subject.daily_topic ? (
                        <p className="mt-1 text-slate-700">{subject.daily_topic}</p>
                      ) : null}
                      {subject.objectives.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Weekly standards:{" "}
                          {subject.objectives
                            .map((objective) => objective.objective_code || objective.description)
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      ) : null}
                      {subject.district_materials.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {subject.district_materials.length} pacing guide material
                          {subject.district_materials.length === 1 ? "" : "s"} attached
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          <div className="flex gap-2">
            <button type="button" className="ta-button-secondary h-9 px-4 text-sm" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="ta-button-primary h-9 px-4 text-sm" onClick={() => void goToStep(3)}>
              Add supplemental materials
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 && review ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pacing guide materials</h2>
            <p className="mt-1 text-xs text-slate-600">
              These come from your adopted pacing guide template. Remove any you do not want included in this package.
            </p>
            <DistrictMaterialsList
              groups={districtMaterials}
              onRemove={(material) => setMaterialToRemove(material)}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">Teacher supplemental materials</h2>
            <p className="mt-1 text-xs text-slate-600">These apply to this planning package only, not the district pacing guide.</p>
            <SupplementalList
              items={review.teacher_supplemental_materials}
              extractingMaterialId={extractingMaterialId}
              onExtract={(materialId) => void extractSupplemental(materialId)}
            />
          <button
            type="button"
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void uploadFiles(Array.from(event.dataTransfer.files));
            }}
            className={`flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed px-4 py-6 text-sm ${
              dragActive ? "border-sky-400 bg-sky-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            Drag and drop supplemental PDFs or files here
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="ta-input h-9" placeholder="Link title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
            <input className="ta-input h-9" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          </div>
          <button type="button" className="ta-button-secondary h-8 px-3 text-xs" onClick={() => void addLink()}>
            Add reference link
          </button>
          <textarea
            className="ta-input min-h-[88px]"
            placeholder="Teacher notes for this package"
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
          />
          <button type="button" className="ta-button-secondary h-8 px-3 text-xs" onClick={() => void addNote()}>
            Add teacher note
          </button>
          </div>
          <div className="flex gap-2">
            <button type="button" className="ta-button-secondary h-9 px-4 text-sm" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" className="ta-button-primary h-9 px-4 text-sm" onClick={() => setStep(4)}>
              Set delivery profile
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Classroom Instruction Profile</h2>
            <p className="mt-1 text-xs text-slate-600">
              Configure how instruction is delivered in your classroom. Controls strand scheduling, delivery
              mode, student text access, and closure requirements — without changing curriculum or TEKS.
            </p>
          </div>

          <div className="space-y-2">
            {DELIVERY_MODES.map((mode) => (
              <label
                key={mode.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  deliveryMode === mode.id
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="delivery-mode"
                  value={mode.id}
                  checked={deliveryMode === mode.id}
                  onChange={() => setDeliveryMode(mode.id)}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{mode.description}</p>
                </div>
              </label>
            ))}
          </div>

          {deliveryMode !== "ai_optimized" ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">
                {deliveryMode === "daily_balanced" ? "Instructional strands (taught every day)" : "Instructional strands (configure days per strand)"}
              </p>
              <div className="space-y-3">
                {deliveryStrands.map((strand, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="ta-input h-8 flex-1 text-sm"
                        placeholder="Strand name (e.g. Reading)"
                        value={strand.strand_name}
                        onChange={(e) => {
                          const updated = [...deliveryStrands];
                          updated[index] = { ...updated[index], strand_name: e.target.value };
                          setDeliveryStrands(updated);
                        }}
                      />
                      {deliveryMode === "daily_balanced" ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="ta-input h-8 w-20 text-center text-sm"
                            type="number"
                            min={1}
                            max={180}
                            placeholder="min"
                            value={strand.minutes_per_day}
                            onChange={(e) => {
                              const updated = [...deliveryStrands];
                              updated[index] = { ...updated[index], minutes_per_day: e.target.value };
                              setDeliveryStrands(updated);
                            }}
                          />
                          <span className="text-xs text-slate-500">min/day</span>
                        </div>
                      ) : null}
                      {deliveryStrands.length > 1 ? (
                        <button
                          type="button"
                          className="ta-button-secondary h-8 px-2 text-xs"
                          onClick={() => setDeliveryStrands((current) => current.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    {deliveryMode === "block_schedule" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {WEEKDAYS.map((day) => (
                          <label key={day} className="flex items-center gap-1 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={strand.days.includes(day)}
                              onChange={(e) => {
                                const updated = [...deliveryStrands];
                                const days = e.target.checked
                                  ? [...updated[index].days, day]
                                  : updated[index].days.filter((d) => d !== day);
                                updated[index] = { ...updated[index], days };
                                setDeliveryStrands(updated);
                              }}
                            />
                            {day.slice(0, 3)}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    {/* Classroom Instruction Profile fields */}
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Classroom Setup</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block space-y-1 text-xs">
                          <span className="font-medium text-slate-600">Delivery mode</span>
                          <select
                            className="ta-input h-9 w-full text-sm"
                            value={strand.delivery_mode}
                            onChange={(e) => {
                              const updated = [...deliveryStrands];
                              updated[index] = { ...updated[index], delivery_mode: e.target.value };
                              setDeliveryStrands(updated);
                            }}
                          >
                            {deliveryModeOptionsForStrand(strand.strand_name).map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <div />
                      </div>
                      {/* Reading text — two separate fields */}
                      <div className="mt-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reading Text</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block space-y-1 text-xs">
                            <span className="font-medium text-slate-600">Curriculum text access</span>
                            <span className="block text-[10px] text-slate-400">How students access the district-assigned lesson text</span>
                            <select
                              className="ta-input h-9 w-full text-sm"
                              value={strand.curriculum_text_access}
                              onChange={(e) => {
                                const updated = [...deliveryStrands];
                                updated[index] = { ...updated[index], curriculum_text_access: e.target.value };
                                setDeliveryStrands(updated);
                              }}
                            >
                              {CURRICULUM_TEXT_ACCESS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {strand.curriculum_text_access === "teacher_copy_only" && (
                              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                                Students will never be asked to open, read, or reference the curriculum text independently.
                              </p>
                            )}
                          </label>
                          <label className="block space-y-1 text-xs">
                            <span className="font-medium text-slate-600">Independent reading access</span>
                            <span className="block text-[10px] text-slate-400">Books students use during independent reading time</span>
                            <select
                              className="ta-input h-9 w-full text-sm"
                              value={strand.independent_reading_access}
                              onChange={(e) => {
                                const updated = [...deliveryStrands];
                                updated[index] = { ...updated[index], independent_reading_access: e.target.value };
                                setDeliveryStrands(updated);
                              }}
                            >
                              {INDEPENDENT_READING_ACCESS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={strand.closure_required}
                          onChange={(e) => {
                            const updated = [...deliveryStrands];
                            updated[index] = { ...updated[index], closure_required: e.target.checked };
                            setDeliveryStrands(updated);
                          }}
                        />
                        <span>Closure required for this strand (exit ticket at end of each block)</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ta-button-secondary h-8 px-3 text-xs"
                onClick={() =>
                  setDeliveryStrands((current) => [
                    ...current,
                    { strand_name: "", minutes_per_day: "", days: [...WEEKDAYS], delivery_mode: "", curriculum_text_access: "", independent_reading_access: "", closure_required: false },
                  ])
                }
              >
                + Add strand
              </button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button type="button" className="ta-button-secondary h-9 px-4 text-sm" onClick={() => setStep(3)}>
              Back
            </button>
            <button type="button" className="ta-button-primary h-9 px-4 text-sm" onClick={() => setStep(5)}>
              Choose outputs
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Outputs and teaching order</h2>
          <p className="text-sm text-slate-600">
            Required: daily lesson plan (all subjects per day) and subject slide decks for {weekLabel}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Plan start date</span>
              <input className="ta-input h-9" type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Plan end date</span>
              <input className="ta-input h-9" type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Instructional time</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Planning thinks in <span className="font-medium">Instructional Days</span>, not calendar dates. Adjust for assemblies,
                field trips, testing days, or any other time that reduces teaching time.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700">Lost instructional days</span>
                <input
                  className="ta-input h-9 w-24"
                  type="number"
                  min={0}
                  max={totalCurriculumDays - 1}
                  value={lostInstructionalDays}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(totalCurriculumDays - 1, parseInt(e.target.value, 10) || 0));
                    setLostInstructionalDays(val);
                  }}
                />
              </label>
              <div className="pb-1 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{totalPlannedDays}</span> of {totalCurriculumDays} instructional days planned
                {lostInstructionalDays > 0 ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {lostInstructionalDays} day{lostInstructionalDays !== 1 ? "s" : ""} compressed
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Teaching order</p>
            <ul className="mt-2 space-y-2">
              {teachingOrder.map((subjectId, index) => {
                const subject = form.subjects.find((row) => row.subject_id === subjectId);
                return (
                  <li key={subjectId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      {index + 1}. {subject?.subject_name ?? subjectId}
                    </span>
                    <span className="flex gap-1">
                      <button type="button" className="ta-button-secondary h-7 px-2 text-xs" onClick={() => moveSubject(index, -1)}>
                        Up
                      </button>
                      <button type="button" className="ta-button-secondary h-7 px-2 text-xs" onClick={() => moveSubject(index, 1)}>
                        Down
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Optional outputs</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pre-selected outputs are recommended based on your pacing guide objectives and subject. You can adjust before generating.
            </p>
            {optionalOutputs.includes("writing_response") ? (
              <p className="mt-1 text-xs text-slate-500">
                A rubric for each writing response will be generated automatically and can be edited after generation.
              </p>
            ) : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {OPTIONAL_OUTPUTS.map((output) => {
                const isRecommended = form.recommended_outputs?.includes(output.id);
                return (
                  <label key={output.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={optionalOutputs.includes(output.id)}
                      onChange={(event) => {
                        setOptionalOutputs((current) =>
                          event.target.checked ? [...current, output.id] : current.filter((value) => value !== output.id),
                        );
                      }}
                    />
                    <span className="flex-1">{output.label}</span>
                    {isRecommended ? (
                      <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                        Recommended
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
          {review?.ai_readiness_summary ? (
            <div
              className={`rounded-xl border px-3 py-3 text-sm ${
                review.ai_readiness_summary.continue_with_filenames_only
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              <p className="font-semibold text-slate-900">AI readiness</p>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <p>Objectives and pacing guide days loaded</p>
                <p>District resources loaded: {review.ai_readiness_summary.district_resources_loaded}</p>
                <p>Teacher supplemental files uploaded: {review.ai_readiness_summary.uploaded_file_count}</p>
                <p>Extracted text available: {review.ai_readiness_summary.extracted_text_available_count}</p>
                <p>Files pending extraction: {review.ai_readiness_summary.files_pending_count}</p>
                <p>Files failed extraction: {review.ai_readiness_summary.files_failed_count}</p>
              </div>
              {review.ai_readiness_summary.continue_with_filenames_only ? (
                <p className="mt-2 text-xs">
                  Some uploaded files have not been extracted yet. AI may only use their filenames and descriptions.
                </p>
              ) : (
                <p className="mt-2 text-xs">Uploaded document text is ready for AI package generation.</p>
              )}
            </div>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-violet-600"
              checked={qualityReviewEnabled}
              onChange={(e) => setQualityReviewEnabled(e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium text-slate-800">AI Quality Review</p>
              <p className="mt-0.5 text-xs text-slate-500">
                An AI coach reviews each artifact after generation and applies corrections. Adds ~65 extra AI calls per package — disable to cut generation time and cost roughly in half.
              </p>
            </div>
          </label>
          <div className="flex gap-2">
            <button type="button" className="ta-button-secondary h-9 px-4 text-sm" onClick={() => setStep(4)}>
              Back
            </button>
            <button
              type="button"
              className="ta-button-primary h-9 px-4 text-sm"
              disabled={generating}
              onClick={() => void generatePackage()}
            >
              {generating ? "Starting..." : "Generate Instructional Package"}
            </button>
          </div>
        </section>
      ) : null}

      <TeacherAssistV2ConfirmModal
        open={materialToRemove !== null}
        title="Remove this material?"
        message={
          materialToRemove
            ? `Remove "${materialToRemove.title}" from this planning package?`
            : ""
        }
        detail="This will not delete the material from your pacing guide — it only excludes it from the package you are building."
        confirmLabel="Yes, remove"
        cancelLabel="No, keep it"
        onCancel={() => setMaterialToRemove(null)}
        onConfirm={() => {
          if (!materialToRemove) return;
          setExcludedPacingMaterialIds((current) =>
            current.includes(materialToRemove.id) ? current : [...current, materialToRemove.id],
          );
          setAlert({ tone: "success", message: `"${materialToRemove.title}" removed from this package.` });
          setMaterialToRemove(null);
        }}
      />
    </div>
  );
}

function DistrictMaterialsList({
  groups,
  onRemove,
}: {
  groups: Array<{ subjectId: string; subjectName: string; materials: PacingGuideSupportingMaterial[] }>;
  onRemove: (material: PacingGuideSupportingMaterial) => void;
}) {
  const totalCount = groups.reduce((sum, group) => sum + group.materials.length, 0);
  if (totalCount === 0) {
    return <p className="mt-2 text-xs text-slate-500">No pacing guide materials for this week.</p>;
  }
  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) =>
        group.materials.length === 0 ? null : (
          <div key={group.subjectId}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.subjectName}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {group.materials.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.material_kind} · {item.resource_type.replaceAll("_", " ")}
                    </p>
                    {item.extraction?.status ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {item.extraction.has_usable_text ? "File text extracted" : `Status: ${item.extraction.status.replaceAll("_", " ")}`}
                      </p>
                    ) : null}
                    {item.extraction?.error_message ? (
                      <p className="mt-1 text-xs text-amber-700">{item.extraction.error_message}</p>
                    ) : null}
                    {item.external_url ? (
                      <p className="mt-1 truncate text-xs text-sky-700">{item.external_url}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="ta-button-secondary h-8 shrink-0 px-3 text-xs"
                    onClick={() => onRemove(item)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}

function SupplementalList({
  items,
  extractingMaterialId,
  onExtract,
}: {
  items: PlanningSupplementalMaterial[];
  extractingMaterialId: string | null;
  onExtract: (materialId: string) => void;
}) {
  if (items.length === 0) return <p className="text-xs text-slate-500">No supplemental materials yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="font-medium text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">
            {item.material_kind} · {item.resource_type.replaceAll("_", " ")}
          </p>
          {item.extraction?.status ? (
            <p className="mt-1 text-xs text-slate-600">
              {item.extraction.has_usable_text
                ? "File text extracted"
                : `Needs attention: ${item.extraction.status.replaceAll("_", " ")}`}
            </p>
          ) : null}
          {item.extraction?.preview ? (
            <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">{item.extraction.preview}</p>
          ) : null}
          {item.extraction?.error_message ? (
            <p className="mt-1 text-xs text-amber-700">{item.extraction.error_message}</p>
          ) : null}
          {item.material_kind === "file" && !item.extraction?.has_usable_text ? (
            <button
              type="button"
              className="ta-button-secondary mt-2 h-8 px-3 text-xs"
              disabled={extractingMaterialId === item.id}
              onClick={() => onExtract(item.id)}
            >
              {extractingMaterialId === item.id ? "Extracting..." : "Extract text"}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
