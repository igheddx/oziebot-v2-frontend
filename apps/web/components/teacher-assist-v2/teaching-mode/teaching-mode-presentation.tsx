"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TeachingSlideVisual } from "@/components/teacher-assist-v2/teaching-mode/teaching-slide-visual";
import type { TeachingPresentationSlide } from "@/lib/teacher-assist-v2-types";

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
  const visualType = currentSlide.visualType ?? currentSlide.visualRecommendation?.visualType;

  return (
    <div ref={containerRef} className="ta-presentation-shell min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
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
          <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-10">
            <article className="ta-presentation-slide w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-14">
              {currentSlide.subjectName ? (
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">{currentSlide.subjectName}</p>
              ) : null}
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/50">{currentSlide.slideType.replaceAll("_", " ")}</p>
              <h1 className="mt-4 text-5xl font-semibold leading-tight sm:text-6xl xl:text-7xl">{currentSlide.title}</h1>
              {currentSlide.subtitle ? <p className="mt-4 text-2xl text-white/80 sm:text-3xl">{currentSlide.subtitle}</p> : null}
              {currentSlide.objectiveText ? (
                <p className="mt-4 text-lg text-sky-100/85 sm:text-2xl">Objective: {currentSlide.objectiveText}</p>
              ) : null}
              <div className={visualSide ? "mt-8 grid gap-8 lg:grid-cols-2 lg:items-center" : "mt-8"}>
                {showVisualOnTop && visualType ? (
                  <TeachingSlideVisual visualType={visualType} />
                ) : null}
                {currentSlide.bullets.length > 0 ? (
                  <ul className="space-y-5 text-2xl leading-relaxed text-white/90 sm:text-3xl">
                    {currentSlide.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span aria-hidden className="mt-3 h-2 w-2 shrink-0 rounded-full bg-sky-300" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!showVisualOnTop && visualType ? (
                  <TeachingSlideVisual visualType={visualType} />
                ) : null}
              </div>
              {currentSlide.visualRecommendation ? (
                <div className="mt-8 rounded-2xl border border-sky-300/20 bg-white/5 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">Visual support</p>
                  <p className="mt-2 text-xl text-white sm:text-2xl">
                    {(currentSlide.visualRecommendation.title || currentSlide.visualRecommendation.visualType || "Recommended visual")
                      .replaceAll("_", " ")}
                  </p>
                  {currentSlide.visualRecommendation.description ? (
                    <p className="mt-2 text-lg text-white/80 sm:text-xl">{currentSlide.visualRecommendation.description}</p>
                  ) : null}
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
            </aside>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-6">
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
