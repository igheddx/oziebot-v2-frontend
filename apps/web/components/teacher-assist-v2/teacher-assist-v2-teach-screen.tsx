"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TeachingModePresentation } from "@/components/teacher-assist-v2/teaching-mode/teaching-mode-presentation";
import { fetchV2InstructionalPackage } from "@/lib/teacher-assist-v2-api";
import {
  buildSlidesForPresentation,
  sortDailyPlans,
} from "@/lib/teaching-mode-slides";
import type { InstructionalPackageDetail } from "@/lib/teacher-assist-v2-types";

type PresentationMode = "daily" | "subject";

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

  const selectedArtifact = useMemo(() => {
    if (!detail) return undefined;
    if (mode === "daily") {
      return dailyArtifacts.find((artifact) => artifact.day_label === selectedDay);
    }
    if (mode === "subject") {
      return subjectArtifacts.find((artifact) => artifact.id === selectedArtifactId);
    }
    return undefined;
  }, [dailyArtifacts, detail, mode, selectedArtifactId, selectedDay, subjectArtifacts]);

  const slides = useMemo(() => buildSlidesForPresentation(selectedArtifact), [selectedArtifact]);

  useEffect(() => {
    if (!autoStart || !detail || presenting) return;
    if (initialMode === "daily" && initialDay && dailyArtifacts.some((item) => item.day_label === initialDay)) {
      setMode("daily");
      setSelectedDay(initialDay);
      setPresenting(true);
    } else if (
      initialMode === "subject" &&
      initialArtifactId &&
      subjectArtifacts.some((item) => item.id === initialArtifactId)
    ) {
      setMode("subject");
      setSelectedArtifactId(initialArtifactId);
      setPresenting(true);
    }
  }, [autoStart, dailyArtifacts, detail, initialArtifactId, initialDay, initialMode, presenting, subjectArtifacts]);

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
    return (
      <TeachingModePresentation
        packageTitle={detail.title}
        presentationTitle={selectedArtifact.title}
        slides={slides}
        onExit={exitToPackage}
      />
    );
  }

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
            <legend className="text-sm font-semibold text-slate-900">Presentation type</legend>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="radio"
                name="presentation-mode"
                className="mt-1"
                checked={mode === "daily"}
                onChange={() => {
                  setMode("daily");
                  setSelectedArtifactId(null);
                }}
              />
              <span>
                <span className="font-medium text-slate-900">Daily Teaching Plan</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Use this to teach the full day across subjects.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="radio"
                name="presentation-mode"
                className="mt-1"
                checked={mode === "subject"}
                onChange={() => {
                  setMode("subject");
                  setSelectedDay(null);
                }}
              />
              <span>
                <span className="font-medium text-slate-900">Subject Slide Deck</span>
                <span className="mt-1 block text-xs text-slate-600">Use this to teach one subject block.</span>
              </span>
            </label>
          </fieldset>

          {mode === "daily" ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Select day</span>
              <select
                className="ta-input mt-2"
                value={selectedDay ?? ""}
                onChange={(event) => setSelectedDay(event.target.value || null)}
              >
                <option value="">Choose a day</option>
                {dailyArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.day_label ?? artifact.id}>
                    {artifact.day_label ?? artifact.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === "subject" ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Select subject</span>
              <select
                className="ta-input mt-2"
                value={selectedArtifactId ?? ""}
                onChange={(event) => setSelectedArtifactId(event.target.value || null)}
              >
                <option value="">Choose a Subject Slide Deck</option>
                {subjectArtifacts.map((artifact) => (
                  <option key={artifact.id} value={artifact.id}>
                    {artifact.subject_name ?? artifact.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            className="ta-button-primary h-11 w-full"
            disabled={!selectedArtifact || slides.length === 0}
            onClick={() => setPresenting(true)}
          >
            Present
          </button>

          {mode === "daily" && dailyArtifacts.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No daily teaching plans were generated for this package.
            </p>
          ) : null}
          {mode === "subject" && subjectArtifacts.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No subject slide decks were generated for this package.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
