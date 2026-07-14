"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TeachingSlideVisual } from "@/components/teacher-assist-v2/teaching-mode/teaching-slide-visual";
import type { TeachingPresentationSlide } from "@/lib/teacher-assist-v2-types";

function slideTheme(slideType: string): { bg: string; text: string; accent: string; bulletDot: string; subtitleColor: string } {
  switch (slideType) {
    case "title":
      return { bg: "bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900", text: "text-white", accent: "text-blue-200", bulletDot: "bg-blue-200", subtitleColor: "text-blue-100/80" };
    case "objective":
      return { bg: "bg-blue-50", text: "text-blue-950", accent: "text-blue-700", bulletDot: "bg-blue-700", subtitleColor: "text-blue-800/70" };
    case "vocabulary":
    case "warm_up":
      return { bg: "bg-purple-50", text: "text-purple-950", accent: "text-purple-700", bulletDot: "bg-purple-700", subtitleColor: "text-purple-800/70" };
    case "mini_lesson":
      return { bg: "bg-amber-50", text: "text-amber-950", accent: "text-amber-700", bulletDot: "bg-amber-700", subtitleColor: "text-amber-800/70" };
    case "guided_practice":
      return { bg: "bg-green-50", text: "text-green-950", accent: "text-green-700", bulletDot: "bg-green-700", subtitleColor: "text-green-800/70" };
    case "independent_practice":
      return { bg: "bg-teal-50", text: "text-teal-950", accent: "text-teal-700", bulletDot: "bg-teal-700", subtitleColor: "text-teal-800/70" };
    case "check_for_understanding":
      return { bg: "bg-sky-50", text: "text-sky-950", accent: "text-sky-700", bulletDot: "bg-sky-700", subtitleColor: "text-sky-800/70" };
    case "exit_ticket":
      return { bg: "bg-yellow-50", text: "text-yellow-950", accent: "text-yellow-700", bulletDot: "bg-yellow-700", subtitleColor: "text-yellow-800/70" };
    case "closing":
      return { bg: "bg-slate-100", text: "text-slate-900", accent: "text-slate-600", bulletDot: "bg-slate-600", subtitleColor: "text-slate-700/70" };
    default:
      return { bg: "bg-white", text: "text-slate-900", accent: "text-slate-600", bulletDot: "bg-slate-600", subtitleColor: "text-slate-600" };
  }
}

type TeachingModePresentationProps = {
  packageTitle: string;
  presentationTitle: string;
  slides: TeachingPresentationSlide[];
  onExit: () => void;
};

export function TeachingModePresentation({
  packageTitle,
  presentationTitle,
  slides,
  onExit,
}: TeachingModePresentationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const currentSlide = slides[currentIndex];
  const total = slides.length;

  const goNext = useCallback(() => {
    setCurrentIndex((value) => Math.min(value + 1, total - 1));
  }, [total]);

  const goPrevious = useCallback(() => {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }, []);

  const requestPresentationFullscreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement !== node && node.requestFullscreen) {
        await node.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked; continue in full-window mode.
    }
  }, []);

  useEffect(() => {
    void requestPresentationFullscreen();
  }, [requestPresentationFullscreen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        } else {
          onExit();
        }
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setShowNotes((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious, onExit]);

  if (!currentSlide) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">No slides available.</p>
          <button type="button" className="ta-presentation-button mt-4" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>
    );
  }

  const layout = currentSlide.layout ?? "text_only";
  const visualSide =
    layout === "text_left_visual_right" ||
    layout === "visual_top_text_bottom" ||
    layout === "two_column" ||
    layout === "concept_map" ||
    layout === "guided_practice" ||
    layout === "independent_practice" ||
    layout === "visual_left_text_right";
  const showVisualOnTop = layout === "visual_top_text_bottom" || layout === "full_width_visual";
  const _noVisualTypes = new Set(["strand_separator", "separator", "transition"]);
  const visualType = _noVisualTypes.has(currentSlide.slideType)
    ? null
    : (currentSlide.visualType ?? currentSlide.visualRecommendation?.visualType);
  const theme = slideTheme(currentSlide.slideType);

  return (
    <div ref={containerRef} className="ta-presentation-shell min-h-dvh bg-slate-950 text-white">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.2em] text-sky-200/80">{packageTitle}</p>
            <p className="truncate text-sm font-medium text-white/90">{presentationTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ta-presentation-button-secondary"
              aria-pressed={showNotes}
              aria-label="Toggle teacher notes"
              onClick={() => setShowNotes((value) => !value)}
            >
              {showNotes ? "Hide notes" : "Show notes"}
            </button>
            <button type="button" className="ta-presentation-button-secondary" aria-label="Exit teaching mode" onClick={onExit}>
              Exit
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col lg:flex-row">
          <main className={`flex flex-1 items-center justify-center px-4 py-8 sm:px-10 ${theme.bg}`}>
            <article className={`ta-presentation-slide w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-14 ${theme.text}`}>
              {currentSlide.subjectName ? (
                <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${theme.accent}`}>{currentSlide.subjectName}</p>
              ) : null}
              <p className={`mt-3 text-xs uppercase tracking-[0.24em] ${theme.subtitleColor}`}>{currentSlide.slideType.replaceAll("_", " ")}</p>
              <h1 className={`mt-4 text-5xl font-semibold leading-tight sm:text-6xl xl:text-7xl ${theme.text}`}>{currentSlide.title}</h1>
              {currentSlide.subtitle ? <p className={`mt-4 text-2xl sm:text-3xl ${theme.subtitleColor}`}>{currentSlide.subtitle}</p> : null}
              {currentSlide.objectiveText ? (
                <p className={`mt-4 text-lg sm:text-2xl ${theme.subtitleColor}`}>Objective: {currentSlide.objectiveText}</p>
              ) : null}
              {currentSlide.body ? (
                <p className={`mt-6 text-xl leading-relaxed sm:text-2xl ${theme.subtitleColor}`}>{currentSlide.body}</p>
              ) : null}
              {currentSlide.layoutType === "before_after" && currentSlide.comparisonPairs && currentSlide.comparisonPairs.length > 0 ? (
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  {currentSlide.comparisonPairs.map((pair, i) => (
                    <div key={i} className="contents">
                      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
                        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-red-700">{pair.label_before || "Before"}</p>
                        <p className="text-xl text-slate-800 sm:text-2xl">{pair.text_before}</p>
                      </div>
                      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-5">
                        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-green-700">{pair.label_after || "After"}</p>
                        <p className="text-xl text-slate-800 sm:text-2xl">{pair.text_after}</p>
                        {pair.explanation ? <p className="mt-3 text-base text-slate-600 sm:text-lg">{pair.explanation}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={visualSide ? "mt-8 grid gap-8 lg:grid-cols-2 lg:items-center" : "mt-8"}>
                {showVisualOnTop && visualType ? (
                  <TeachingSlideVisual visualType={visualType} />
                ) : null}
                {currentSlide.bullets.length > 0 ? (
                  <ul className={`space-y-5 text-2xl leading-relaxed sm:text-3xl ${theme.text}`}>
                    {currentSlide.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span aria-hidden className={`mt-3 h-2 w-2 shrink-0 rounded-full ${theme.bulletDot}`} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!showVisualOnTop && visualType ? (
                  <TeachingSlideVisual visualType={visualType} />
                ) : null}
              </div>
              {currentSlide.discussionQuestion ? (
                <div className="mt-8 rounded-2xl border-2 border-current/20 bg-black/5 p-5">
                  <p className={`text-sm font-bold uppercase tracking-wide ${theme.accent}`}>Discussion</p>
                  <p className={`mt-2 text-xl sm:text-2xl ${theme.text}`}>{currentSlide.discussionQuestion}</p>
                </div>
              ) : null}
            </article>
          </main>

          {showNotes ? (
            <aside className="border-t border-white/10 bg-black/30 px-4 py-4 lg:w-96 lg:border-l lg:border-t-0 lg:px-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-200">Teacher notes</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">
                {currentSlide.teacherNotes?.trim() || "No teacher notes for this slide."}
              </p>
              {currentSlide.speakerNotes ? (
                <>
                  <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-sky-200">Speaker script</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">{currentSlide.speakerNotes.trim()}</p>
                </>
              ) : null}
            </aside>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950 px-4 py-4 sm:px-6">
          <button
            type="button"
            className="ta-presentation-nav"
            aria-label="Previous slide"
            disabled={currentIndex === 0}
            onClick={goPrevious}
          >
            Previous
          </button>
          <p className="text-sm font-medium text-white/80" aria-live="polite">
            Slide {currentIndex + 1} of {total}
          </p>
          <button
            type="button"
            className="ta-presentation-nav"
            aria-label="Next slide"
            disabled={currentIndex >= total - 1}
            onClick={goNext}
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  );
}
