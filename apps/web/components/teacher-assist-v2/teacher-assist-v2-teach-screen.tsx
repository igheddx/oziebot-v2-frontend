"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StudentLessonPresentation } from "@/components/teacher-assist-v2/teaching-mode/student-lesson-presentation";
import { TeachingModePresentation } from "@/components/teacher-assist-v2/teaching-mode/teaching-mode-presentation";
import { TeachingBriefPanel } from "@/components/teacher-assist-v2/teacher-assist-v2-coaching-brief";
import { fetchV2InstructionalPackage, triggerArtifactImageFetch } from "@/lib/teacher-assist-v2-api";
import {
  buildSlidesForPresentation,
  formatDayLabel,
  sortDailyPlans,
} from "@/lib/teaching-mode-slides";
import type { InstructionalPackageArtifact, InstructionalPackageDetail } from "@/lib/teacher-assist-v2-types";

type PresentationMode = "daily" | "subject" | "student_daily" | "student_subject";

function ImageFetchBanner({
  artifact,
  state,
  message,
  onFetch,
}: {
  artifact: InstructionalPackageArtifact;
  state: "idle" | "loading" | "done" | "error";
  message: string | null;
  onFetch: () => void;
}) {
  const assets = artifact.slide_visual_assets ?? [];
  const pendingCount = assets.filter((a) => a.visual_generation_status === "pending").length;
  const failedCount = assets.filter((a) => a.visual_generation_status === "failed").length;
  const fetchedCount = assets.filter((a) => a.visual_generation_status === "fetched").length;

  if (state === "done" && message) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {message}
      </div>
    );
  }

  if (state === "error" && message) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {message}
      </div>
    );
  }

  if (pendingCount === 0 && failedCount === 0) {
    if (fetchedCount > 0) {
      return (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {fetchedCount} slide image{fetchedCount !== 1 ? "s" : ""} ready.
        </div>
      );
    }
    return null;
  }

  const label =
    pendingCount > 0
      ? `${pendingCount} slide image${pendingCount !== 1 ? "s" : ""} pending`
      : `${failedCount} slide image${failedCount !== 1 ? "s" : ""} could not load`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <span>{label}. Fetch from Pixabay to load visuals.</span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        disabled={state === "loading"}
        onClick={onFetch}
      >
        {state === "loading" ? "Fetching…" : "Fetch Images"}
      </button>
    </div>
  );
}

export function TeacherAssistV2TeachScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get("packageId") ?? "";
  const initialMode = (searchParams.get("mode") as PresentationMode | null) ?? null;
  const initialDay = searchParams.get("day");
  const initialArtifactId = searchParams.get("artifactId");
  const autoStart = searchParams.get("start") === "1";

  const [detail, setDetail] = useState<InstructionalPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PresentationMode | null>(initialMode);
  const [selectedDay, setSelectedDay] = useState<string | null>(initialDay);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(initialArtifactId);
  const [presenting, setPresenting] = useState(false);
  const [imageFetchState, setImageFetchState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [imageFetchMessage, setImageFetchMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!packageId) {
      setLoading(false);
      return;
    }
    void fetchV2InstructionalPackage(packageId)
      .then(setDetail)
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [packageId]);

  const dailyArtifacts = useMemo(() => {
    if (!detail) return [];
    return sortDailyPlans(detail.artifact_groups.daily_teaching_plans ?? []);
  }, [detail]);

  const subjectArtifacts = useMemo(() => {
    return detail?.artifact_groups.subject_slide_decks ?? [];
  }, [detail]);

  const studentDailyArtifacts = useMemo(() => {
    if (!detail) return [];
    return sortDailyPlans(
      (detail.artifact_groups.student_lesson_decks ?? []).filter((a) => Boolean(a.day_label)),
    );
  }, [detail]);

  const studentSubjectArtifacts = useMemo(() => {
    return (detail?.artifact_groups.student_lesson_decks ?? []).filter((a) => !a.day_label);
  }, [detail]);

  const selectedArtifact = useMemo((): InstructionalPackageArtifact | undefined => {
    if (!detail) return undefined;
    if (mode === "daily") {
      return dailyArtifacts.find((a) => a.day_label === selectedDay);
    }
    if (mode === "subject") {
      return subjectArtifacts.find((a) => a.id === selectedArtifactId);
    }
    if (mode === "student_daily") {
      return studentDailyArtifacts.find((a) => a.day_label === selectedDay);
    }
    if (mode === "student_subject") {
      return studentSubjectArtifacts.find((a) => a.id === selectedArtifactId);
    }
    return undefined;
  }, [dailyArtifacts, detail, mode, selectedArtifactId, selectedDay, subjectArtifacts, studentDailyArtifacts, studentSubjectArtifacts]);

  const slides = useMemo(() => buildSlidesForPresentation(selectedArtifact), [selectedArtifact]);

  useEffect(() => {
    if (!autoStart || !detail || presenting) return;
    if (initialMode === "daily" && initialDay && dailyArtifacts.some((a) => a.day_label === initialDay)) {
      setMode("daily");
      setSelectedDay(initialDay);
      setPresenting(true);
    } else if (initialMode === "subject" && initialArtifactId && subjectArtifacts.some((a) => a.id === initialArtifactId)) {
      setMode("subject");
      setSelectedArtifactId(initialArtifactId);
      setPresenting(true);
    } else if (initialMode === "student_daily" && initialDay && studentDailyArtifacts.some((a) => a.day_label === initialDay)) {
      setMode("student_daily");
      setSelectedDay(initialDay);
      setPresenting(true);
    } else if (initialMode === "student_subject" && initialArtifactId && studentSubjectArtifacts.some((a) => a.id === initialArtifactId)) {
      setMode("student_subject");
      setSelectedArtifactId(initialArtifactId);
      setPresenting(true);
    }
  }, [autoStart, dailyArtifacts, detail, initialArtifactId, initialDay, initialMode, presenting, subjectArtifacts, studentDailyArtifacts, studentSubjectArtifacts]);

  const handleFetchImages = async () => {
    if (!selectedArtifact) return;
    setImageFetchState("loading");
    setImageFetchMessage(null);
    try {
      const result = await triggerArtifactImageFetch(selectedArtifact.id);
      setImageFetchMessage(result.message);
      setImageFetchState("done");
      // Reload the package so slide_visual_assets reflects the new fetched images
      const refreshed = await fetchV2InstructionalPackage(packageId);
      setDetail(refreshed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image fetch failed";
      setImageFetchMessage(msg);
      setImageFetchState("error");
    }
  };

  const exitToPackage = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    router.push(`/teacher-assist-v2/packages/view?id=${packageId}`);
  };

  if (!packageId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-6 text-center text-rose-800">
          <p className="font-semibold">Package not specified.</p>
          <Link href="/teacher-assist-v2/packages" className="mt-3 inline-flex text-sky-700">
            Back to packages
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6 text-slate-600">
        Loading teaching mode...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-6 text-center text-rose-800">
          <p className="font-semibold">{error ?? "Package not found."}</p>
          <Link href="/teacher-assist-v2/packages" className="mt-3 inline-flex text-sky-700">
            Back to packages
          </Link>
        </div>
      </div>
    );
  }

  if (!detail.teaching_mode_available) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <div className="max-w-xl rounded-3xl border border-amber-200 bg-white p-6 text-center">
          <p className="text-lg font-semibold text-slate-900">No teaching content is available yet.</p>
          <p className="mt-2 text-sm text-slate-600">Return to the package and generate lesson materials.</p>
          <Link href={`/teacher-assist-v2/packages/view?id=${packageId}`} className="ta-button-primary mt-4 inline-flex h-10 items-center px-4">
            Back to package
          </Link>
        </div>
      </div>
    );
  }

  if (presenting && selectedArtifact) {
    const isStudentMode = mode === "student_daily" || mode === "student_subject";
    if (isStudentMode) {
      return (
        <StudentLessonPresentation
          packageTitle={detail.title}
          presentationTitle={selectedArtifact.title}
          artifactId={selectedArtifact.id}
          slides={slides}
          onExit={exitToPackage}
        />
      );
    }
    return (
      <TeachingModePresentation
        packageTitle={detail.title}
        presentationTitle={selectedArtifact.title}
        slides={slides}
        onExit={exitToPackage}
      />
    );
  }

  const isStudentMode = mode === "student_daily" || mode === "student_subject";
  const isDayMode = mode === "daily" || mode === "student_daily";
  const isSubjectMode = mode === "subject" || mode === "student_subject";

  const activeDayArtifacts = isStudentMode ? studentDailyArtifacts : dailyArtifacts;
  const activeSubjectArtifacts = isStudentMode ? studentSubjectArtifacts : subjectArtifacts;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6">
      <div className="ta-panel p-6 sm:p-8">
        <Link href={`/teacher-assist-v2/packages/view?id=${packageId}`} className="text-xs font-semibold text-sky-700">
          ← Back to package
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Choose what to present</h1>
        <p className="mt-2 text-sm text-slate-600">{detail.title}</p>

        <div className="mt-6 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Audience</legend>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="radio"
                name="audience"
                className="mt-1"
                checked={!isStudentMode}
                onChange={() => {
                  setMode(isDayMode ? "daily" : isSubjectMode ? "subject" : "daily");
                  setSelectedArtifactId(null);
                }}
              />
              <span>
                <span className="font-medium text-slate-900">Teacher View</span>
                <span className="mt-1 block text-xs text-slate-600">Lesson plan and subject decks with teacher notes and speaker scripts.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
              <input
                type="radio"
                name="audience"
                className="mt-1"
                checked={isStudentMode}
                onChange={() => {
                  setMode(isDayMode ? "student_daily" : isSubjectMode ? "student_subject" : "student_daily");
                  setSelectedArtifactId(null);
                }}
              />
              <span>
                <span className="font-medium text-violet-900">Student Lesson Deck</span>
                <span className="mt-1 block text-xs text-violet-700">Colorful, grade-appropriate slides projected for students during class.</span>
              </span>
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">Presentation type</legend>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="radio"
                name="presentation-mode"
                className="mt-1"
                checked={isDayMode}
                onChange={() => {
                  setMode(isStudentMode ? "student_daily" : "daily");
                  setSelectedArtifactId(null);
                }}
              />
              <span>
                <span className="font-medium text-slate-900">By Day</span>
                <span className="mt-1 block text-xs text-slate-600">One presentation per day covering the day&apos;s subjects.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="radio"
                name="presentation-mode"
                className="mt-1"
                checked={isSubjectMode}
                onChange={() => {
                  setMode(isStudentMode ? "student_subject" : "subject");
                  setSelectedDay(null);
                }}
              />
              <span>
                <span className="font-medium text-slate-900">By Subject</span>
                <span className="mt-1 block text-xs text-slate-600">One presentation per subject for the week.</span>
              </span>
            </label>
          </fieldset>

          {isDayMode ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Select day</span>
              <select
                className="ta-input mt-2"
                value={selectedDay ?? ""}
                onChange={(event) => setSelectedDay(event.target.value || null)}
              >
                <option value="">Choose a day</option>
                {activeDayArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.day_label ?? artifact.id}>
                    {formatDayLabel(artifact.day_label) || artifact.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isSubjectMode ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Select subject</span>
              <select
                className="ta-input mt-2"
                value={selectedArtifactId ?? ""}
                onChange={(event) => setSelectedArtifactId(event.target.value || null)}
              >
                <option value="">Choose a subject</option>
                {activeSubjectArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.subject_name ?? artifact.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {/* Teaching Brief — shown when a day is selected, before launching */}
          {isDayMode && selectedDay && detail.teacher_teaching_brief ? (
            <TeachingBriefPanel
              brief={detail.teacher_teaching_brief}
              selectedDay={selectedDay}
            />
          ) : null}

          <button
            type="button"
            className={isStudentMode ? "h-11 w-full rounded-2xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40" : "ta-button-primary h-11 w-full"}
            disabled={!selectedArtifact || slides.length === 0}
            onClick={() => setPresenting(true)}
          >
            {isStudentMode ? "Present to Students" : "Present"}
          </button>

          {isStudentMode && selectedArtifact ? (
            <ImageFetchBanner
              artifact={selectedArtifact}
              state={imageFetchState}
              message={imageFetchMessage}
              onFetch={() => { void handleFetchImages(); }}
            />
          ) : null}

          {isDayMode && activeDayArtifacts.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No {isStudentMode ? "student lesson decks" : "daily teaching plans"} were generated for this package.
            </p>
          ) : null}
          {isSubjectMode && activeSubjectArtifacts.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No {isStudentMode ? "student subject decks" : "subject slide decks"} were generated for this package.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
