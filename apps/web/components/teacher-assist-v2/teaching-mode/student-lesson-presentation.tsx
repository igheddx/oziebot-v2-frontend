"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { authFetch } from "@/lib/auth-service";
import type { TeachingPresentationSlide } from "@/lib/teacher-assist-v2-types";

// ─── Authenticated image hook ─────────────────────────────────────────────────
// The slide-image endpoint requires a Bearer token. <img src> can't send headers,
// so we fetch with authFetch, convert to a blob URL, and use that as src.

function useAuthImageSrc(apiPath: string | null): {
  src: string | null;
  loading: boolean;
  error: boolean;
} {
  const [state, setState] = useState<{ src: string | null; loading: boolean; error: boolean }>({
    src: null,
    loading: false,
    error: false,
  });

  useEffect(() => {
    if (!apiPath) {
      setState({ src: null, loading: false, error: false });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ src: null, loading: true, error: false });
    authFetch(apiPath)
      .then(res => {
        if (!res || !res.ok) throw new Error(`${res?.status ?? "request failed"}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) { URL.revokeObjectURL(URL.createObjectURL(blob)); return; }
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiPath]);

  return state;
}

// ─── Theme helpers ────────────────────────────────────────────────────────────

function accentHex(slideType: string): string {
  switch (slideType) {
    case "hook":           return "#7c3aed";
    case "today_we_learn": return "#1d4ed8";
    case "vocabulary":     return "#0d9488";
    case "concept":        return "#d97706";
    case "example":        return "#dc2626";
    case "your_turn":      return "#16a34a";
    case "check_in":       return "#0284c7";
    case "wrap_up":        return "#9333ea";
    default:               return "#475569";
  }
}

function accentLight(slideType: string): string {
  switch (slideType) {
    case "hook":           return "#ede9fe";
    case "today_we_learn": return "#dbeafe";
    case "vocabulary":     return "#ccfbf1";
    case "concept":        return "#fef3c7";
    case "example":        return "#fee2e2";
    case "your_turn":      return "#dcfce7";
    case "check_in":       return "#e0f2fe";
    case "wrap_up":        return "#f3e8ff";
    default:               return "#f1f5f9";
  }
}

function engagementLabel(type: string): string {
  switch (type) {
    case "think_pair_share": return "Think · Pair · Share";
    case "turn_and_talk":    return "Turn & Talk";
    case "show_fingers":     return "Show Fingers";
    case "whiteboard":       return "Whiteboard";
    case "quick_draw":       return "Quick Draw";
    case "exit_ticket":      return "Exit Ticket";
    default:                 return "Engage";
  }
}

// ─── Fallback SVG organizers (fill any container) ────────────────────────────

function FallbackOrganizer({ type }: { type?: string }) {
  if (type === "vocabulary_card") {
    return (
      <svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
        <rect x="10" y="10" width="300" height="200" rx="18" fill="#fff7ed" stroke="#fb923c" strokeWidth="3" />
        <rect x="30" y="30" width="100" height="100" rx="12" fill="#ffedd5" stroke="#ea580c" strokeWidth="2" />
        <rect x="148" y="30" width="148" height="36" rx="10" fill="#fff" stroke="#fdba74" strokeWidth="2" />
        <rect x="148" y="78" width="148" height="26" rx="8" fill="#fffbeb" />
        <rect x="148" y="114" width="140" height="22" rx="8" fill="#fffbeb" />
        <text x="80" y="88" textAnchor="middle" fontSize="13" fill="#9a3412" fontWeight="700">WORD</text>
        <text x="222" y="54" textAnchor="middle" fontSize="12" fill="#44403c" fontWeight="600">Definition</text>
        <text x="222" y="96" textAnchor="middle" fontSize="11" fill="#78716c">Example sentence here</text>
        <text x="222" y="130" textAnchor="middle" fontSize="11" fill="#78716c">Image / drawing</text>
        <rect x="30" y="148" width="260" height="40" rx="10" fill="#fed7aa" />
        <text x="160" y="173" textAnchor="middle" fontSize="12" fill="#7c2d12">My own sentence: ____________________</text>
      </svg>
    );
  }
  if (type === "process_flow") {
    return (
      <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
        <line x1="50" y1="120" x2="350" y2="120" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" />
        <circle cx="90" cy="120" r="36" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <circle cx="200" cy="120" r="36" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <circle cx="310" cy="120" r="36" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <text x="90" y="128" textAnchor="middle" fontSize="22" fill="#075985" fontWeight="800">1</text>
        <text x="200" y="128" textAnchor="middle" fontSize="22" fill="#075985" fontWeight="800">2</text>
        <text x="310" y="128" textAnchor="middle" fontSize="22" fill="#075985" fontWeight="800">3</text>
        <text x="90" y="182" textAnchor="middle" fontSize="16" fill="#334155" fontWeight="600">Read</text>
        <text x="200" y="182" textAnchor="middle" fontSize="16" fill="#334155" fontWeight="600">Think</text>
        <text x="310" y="182" textAnchor="middle" fontSize="16" fill="#334155" fontWeight="600">Respond</text>
        <polygon points="148,114 164,120 148,126" fill="#0284c7" />
        <polygon points="258,114 274,120 258,126" fill="#0284c7" />
      </svg>
    );
  }
  if (type === "venn") {
    return (
      <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
        <circle cx="136" cy="130" r="108" fill="#dbeafe" stroke="#2563eb" strokeWidth="4" fillOpacity="0.6" />
        <circle cx="224" cy="130" r="108" fill="#dcfce7" stroke="#16a34a" strokeWidth="4" fillOpacity="0.5" />
        <text x="82" y="100" textAnchor="middle" fontSize="15" fill="#1e40af" fontWeight="700">Only A</text>
        <text x="180" y="100" textAnchor="middle" fontSize="15" fill="#166534" fontWeight="700">Both</text>
        <text x="278" y="100" textAnchor="middle" fontSize="15" fill="#166534" fontWeight="700">Only B</text>
      </svg>
    );
  }
  if (type === "timeline") {
    return (
      <svg viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
        <line x1="40" y1="100" x2="440" y2="100" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" />
        <circle cx="90" cy="100" r="34" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <circle cx="210" cy="100" r="34" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <circle cx="330" cy="100" r="34" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <circle cx="440" cy="100" r="28" fill="#bfdbfe" stroke="#0284c7" strokeWidth="3" />
        <text x="90" y="108" textAnchor="middle" fontSize="20" fill="#075985" fontWeight="800">1</text>
        <text x="210" y="108" textAnchor="middle" fontSize="20" fill="#075985" fontWeight="800">2</text>
        <text x="330" y="108" textAnchor="middle" fontSize="20" fill="#075985" fontWeight="800">3</text>
        <text x="90" y="162" textAnchor="middle" fontSize="15" fill="#334155" fontWeight="600">Step 1</text>
        <text x="210" y="162" textAnchor="middle" fontSize="15" fill="#334155" fontWeight="600">Step 2</text>
        <text x="330" y="162" textAnchor="middle" fontSize="15" fill="#334155" fontWeight="600">Step 3</text>
        <polygon points="156,94 172,100 156,106" fill="#0284c7" />
        <polygon points="276,94 292,100 276,106" fill="#0284c7" />
      </svg>
    );
  }
  if (type === "comparison_table") {
    return (
      <svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
        <rect x="20" y="20" width="440" height="280" rx="18" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
        <line x1="240" y1="20" x2="240" y2="300" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="20" y1="82" x2="460" y2="82" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="20" y1="144" x2="460" y2="144" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="20" y1="206" x2="460" y2="206" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="20" y1="258" x2="460" y2="258" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="20" y="20" width="220" height="62" rx="12" fill="#dbeafe" />
        <rect x="240" y="20" width="220" height="62" rx="12" fill="#bfdbfe" />
        <text x="130" y="58" textAnchor="middle" fontSize="20" fill="#1e40af" fontWeight="800">Column A</text>
        <text x="350" y="58" textAnchor="middle" fontSize="20" fill="#1e40af" fontWeight="800">Column B</text>
      </svg>
    );
  }
  // Default: concept map
  return (
    <svg viewBox="0 0 480 340" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden>
      <circle cx="240" cy="170" r="82" fill="#dbeafe" stroke="#2563eb" strokeWidth="6" />
      <text x="240" y="164" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e3a8a">Main</text>
      <text x="240" y="190" textAnchor="middle" fontSize="20" fill="#1e40af">Idea</text>
      <line x1="240" y1="86" x2="240" y2="40" stroke="#64748b" strokeWidth="4" />
      <line x1="168" y1="228" x2="96" y2="294" stroke="#64748b" strokeWidth="4" />
      <line x1="312" y1="228" x2="384" y2="294" stroke="#64748b" strokeWidth="4" />
      <rect x="190" y="12" width="100" height="40" rx="16" fill="#ecfeff" stroke="#0891b2" strokeWidth="3" />
      <rect x="28" y="280" width="136" height="46" rx="16" fill="#ecfeff" stroke="#0891b2" strokeWidth="3" />
      <rect x="316" y="280" width="136" height="46" rx="16" fill="#ecfeff" stroke="#0891b2" strokeWidth="3" />
      <text x="240" y="39" textAnchor="middle" fontSize="16" fill="#155e75">Detail</text>
      <text x="96" y="309" textAnchor="middle" fontSize="16" fill="#155e75">Detail</text>
      <text x="384" y="309" textAnchor="middle" fontSize="16" fill="#155e75">Detail</text>
    </svg>
  );
}

// ─── Image pending placeholder ────────────────────────────────────────────────

function ImagePendingPlaceholder({ accent }: { accent: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl"
      style={{ backgroundColor: accent + "12", border: `3px dashed ${accent}50` }}
    >
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" aria-hidden>
        <rect x="6" y="18" width="52" height="38" rx="8" fill="none" stroke={accent} strokeWidth="3" />
        <circle cx="32" cy="36" r="10" fill="none" stroke={accent} strokeWidth="3" />
        <circle cx="32" cy="36" r="4" fill={accent} fillOpacity="0.4" />
        <path d="M22 18v-4a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v4" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="29" x2="16" y2="29" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-lg font-semibold" style={{ color: accent }}>Image coming soon</p>
      <p className="text-sm text-slate-400">Visual will appear here when ready</p>
    </div>
  );
}

// ─── Image path resolution ────────────────────────────────────────────────────
// Returns the API path for locally-stored images (requires Bearer auth via hook),
// or null if no local image is available.

function resolveApiImagePath(slide: TeachingPresentationSlide, artifactId: string): string | null {
  if (slide.visual?.local_asset_key) {
    return `/v1/teacher-assist-v2/teacher/artifacts/${artifactId}/slide-image/${slide.id}`;
  }
  return null;
}

// ─── Slide image (handles pending / fetched / failed) ─────────────────────────

function SlideImage({
  slide,
  artifactId,
  accent,
  className = "",
}: {
  slide: TeachingPresentationSlide;
  artifactId: string;
  accent: string;
  className?: string;
}) {
  const status = slide.visual?.visual_generation_status;
  const apiPath = resolveApiImagePath(slide, artifactId);
  const externalUrl = slide.visual?.source_url ?? null;
  const { src: authSrc, loading, error: authError } = useAuthImageSrc(apiPath);
  const imageUrl = authSrc ?? (!apiPath ? externalUrl : null);
  const altText = slide.visual?.image_search?.image_alt_text;
  const fallbackType = slide.visual?.fallback_organizer_type;

  // Show pending placeholder while genuinely pending, while the auth-fetch is loading,
  // or during the brief gap before useEffect fires (apiPath set but src not yet arrived).
  const waitingForImage = status === "pending" || loading || (apiPath !== null && !authSrc && !authError);

  if (waitingForImage) {
    return (
      <div className={`overflow-hidden rounded-2xl ${className}`}>
        <ImagePendingPlaceholder accent={accent} />
      </div>
    );
  }

  if (imageUrl && !authError && status !== "failed") {
    return (
      <div className={`overflow-hidden rounded-2xl shadow-lg ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={altText ?? "Lesson visual"}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl bg-slate-50 p-4 ${className}`}>
      <FallbackOrganizer type={fallbackType} />
    </div>
  );
}

// ─── Engagement block ─────────────────────────────────────────────────────────

function EngagementBlock({
  engagement,
  accent,
  accentLighter,
  dark = false,
}: {
  engagement: { type: string; prompt: string } | null | undefined;
  accent: string;
  accentLighter: string;
  dark?: boolean;
}) {
  if (!engagement) return null;
  return (
    <div
      className="mt-5 shrink-0 rounded-2xl px-6 py-5"
      style={
        dark
          ? { backgroundColor: accent, border: `2px solid ${accent}` }
          : { backgroundColor: accentLighter, border: `2px solid ${accent}` }
      }
    >
      <p
        className="mb-1 text-sm font-bold uppercase tracking-widest"
        style={{ color: dark ? "rgba(255,255,255,0.75)" : accent }}
      >
        {engagementLabel(engagement.type)}
      </p>
      <p
        className="text-2xl font-semibold sm:text-3xl"
        style={{ color: dark ? "#fff" : "#1e293b" }}
      >
        {engagement.prompt}
      </p>
    </div>
  );
}

// ─── Template props type ──────────────────────────────────────────────────────

type TemplateProps = {
  slide: TeachingPresentationSlide;
  artifactId: string;
  accent: string;
  accentLighter: string;
};

// ─── Template 1: title_full ───────────────────────────────────────────────────
// Full-screen background image with gradient overlay; title/body at bottom.

function TitleFullTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  const status = slide.visual?.visual_generation_status;
  const apiPath = resolveApiImagePath(slide, artifactId);
  const externalUrl = slide.visual?.source_url ?? null;
  const { src: authSrc, loading, error: authError } = useAuthImageSrc(apiPath);
  const imageUrl = authSrc ?? (!apiPath ? externalUrl : null);
  const altText = slide.visual?.image_search?.image_alt_text;
  const waitingForImage = status === "pending" || loading || (apiPath !== null && !authSrc && !authError);
  const hasRealImage = imageUrl && !authError && !waitingForImage;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-slate-900">
      {hasRealImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={altText ?? "Lesson visual"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : waitingForImage ? (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: accent + "25" }}>
          <ImagePendingPlaceholder accent={accent} />
        </div>
      ) : (
        <div className="absolute inset-0 p-8">
          <FallbackOrganizer type={slide.visual?.fallback_organizer_type} />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

      {/* Content — overlaid at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-14 pb-12 pt-16">
        <p className="mb-3 text-base font-bold uppercase tracking-[0.28em]" style={{ color: accentLighter }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-6xl font-extrabold leading-[1.05] text-white sm:text-7xl lg:text-8xl">
          {slide.title}
        </h1>
        {slide.body ? (
          <p className="mt-5 text-2xl leading-relaxed text-white/80 sm:text-3xl">{slide.body}</p>
        ) : null}
        {slide.engagement ? (
          <div
            className="mt-6 inline-block rounded-2xl px-7 py-4"
            style={{ backgroundColor: accent + "cc" }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              {engagementLabel(slide.engagement.type)}
            </p>
            <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">
              {slide.engagement.prompt}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Template 2: objective_image ──────────────────────────────────────────────
// Left 58%: text content. Right 42%: image fills column.

function ObjectiveImageTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  return (
    <div className="flex h-full w-full bg-white">
      {/* Text side */}
      <div className="flex w-[58%] flex-col justify-center px-14 py-10">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-5xl font-extrabold leading-tight text-slate-900 sm:text-6xl lg:text-[4.5rem]">
          {slide.title}
        </h1>
        {slide.body ? (
          <p className="mt-5 text-[2rem] leading-relaxed text-slate-700 sm:text-[2.25rem]">{slide.body}</p>
        ) : null}
        {slide.bullets.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl px-5 py-3.5 text-2xl font-medium text-slate-800 sm:text-3xl"
                style={{ backgroundColor: accentLighter }}
              >
                <span
                  className="mt-2.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} />
      </div>
      {/* Image side */}
      <div className="w-[42%] p-6 pl-0">
        <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
      </div>
    </div>
  );
}

// ─── Template 3: vocabulary_showcase ─────────────────────────────────────────
// Top band: word (huge). Bottom: left = image, right = definition + example.

function VocabularyShowcaseTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  const definition = slide.body ?? (slide.bullets[0] ?? "");
  const exampleBullets = slide.body ? slide.bullets : slide.bullets.slice(1);

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Word banner — top 28% */}
      <div
        className="flex shrink-0 flex-col justify-center px-12 py-6"
        style={{ backgroundColor: accent, minHeight: "28%" }}
      >
        <p className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-white/70">Vocabulary</p>
        <h1 className="text-6xl font-black text-white sm:text-7xl lg:text-8xl">{slide.title}</h1>
      </div>
      {/* Bottom — image + definition */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-[44%] p-6 pr-3">
          <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
        </div>
        <div className="flex w-[56%] flex-col justify-center px-10 py-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>
            Definition
          </p>
          <p className="text-2xl leading-relaxed text-slate-800 sm:text-3xl">{definition}</p>
          {exampleBullets.length > 0 ? (
            <>
              <p className="mb-2 mt-6 text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>
                Example
              </p>
              <p className="text-xl leading-relaxed text-slate-600 italic sm:text-2xl">
                {exampleBullets[0]}
              </p>
            </>
          ) : null}
          <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} />
        </div>
      </div>
    </div>
  );
}

// ─── Template 4: hook_full_image ──────────────────────────────────────────────
// Top 62%: full-bleed image. Bottom 38%: title + engagement.

function HookFullImageTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Image — 62% */}
      <div className="min-h-0 overflow-hidden" style={{ height: "62%" }}>
        <SlideImage
          slide={slide}
          artifactId={artifactId}
          accent={accent}
          className="h-full w-full rounded-none"
        />
      </div>
      {/* Content — 38% */}
      <div
        className="flex flex-1 flex-col justify-center px-12 py-8"
        style={{ backgroundColor: accentLighter }}
      >
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          {slide.title}
        </h1>
        {slide.body ? (
          <p className="mt-3 text-xl leading-relaxed text-slate-700 sm:text-2xl">{slide.body}</p>
        ) : null}
        {slide.engagement ? (
          <div
            className="mt-4 inline-block rounded-2xl px-6 py-4"
            style={{ backgroundColor: accent }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              {engagementLabel(slide.engagement.type)}
            </p>
            <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">
              {slide.engagement.prompt}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Template 5: teacher_modeling ────────────────────────────────────────────
// Left 44%: image. Right 56%: title + numbered steps.

function TeacherModelingTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  return (
    <div className="flex h-full w-full bg-white">
      {/* Image */}
      <div className="w-[44%] p-8 pr-4">
        <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
      </div>
      {/* Content */}
      <div className="flex w-[56%] flex-col justify-center px-10 py-10">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-5xl font-extrabold leading-tight text-slate-900 sm:text-6xl">
          {slide.title}
        </h1>
        {slide.body ? (
          <p className="mt-4 text-[2rem] leading-relaxed text-slate-700 sm:text-[2.25rem]">{slide.body}</p>
        ) : null}
        {slide.bullets.length > 0 ? (
          <ol className="mt-5 space-y-3">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black text-white"
                  style={{ backgroundColor: accent }}
                >
                  {i + 1}
                </span>
                <span className="text-2xl leading-relaxed text-slate-800 sm:text-3xl">{b}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} />
      </div>
    </div>
  );
}

// ─── Template 6: before_after ────────────────────────────────────────────────
// Title row, then two large cards with an arrow between them.

function BeforeAfterTemplate({ slide, accent, accentLighter }: TemplateProps) {
  const pairs = slide.comparisonPairs ?? [];
  const pair = pairs[0];
  const beforeText = pair?.text_before ?? (slide.bullets[0] ?? slide.body ?? "");
  const afterText = pair?.text_after ?? (slide.bullets[1] ?? "");

  return (
    <div className="flex h-full w-full flex-col bg-white px-10 py-8">
      <p className="mb-1 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
        {slide.slideType.replaceAll("_", " ")}
      </p>
      <h1 className="mb-6 text-5xl font-extrabold text-slate-900 sm:text-6xl">{slide.title}</h1>
      <div className="flex min-h-0 flex-1 items-center gap-4">
        {/* Before */}
        <div className="flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-red-200 bg-red-50 p-8">
          <p className="mb-4 text-base font-black uppercase tracking-[0.2em] text-red-600">
            {pair?.label_before ?? "Before"}
          </p>
          <p className="flex-1 text-3xl leading-relaxed text-slate-800 sm:text-4xl">{beforeText}</p>
        </div>
        {/* Arrow */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" aria-hidden>
            <path
              d="M8 28h40M34 14l14 14-14 14"
              stroke={accent}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        {/* After */}
        <div className="flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-green-200 bg-green-50 p-8">
          <p className="mb-4 text-base font-black uppercase tracking-[0.2em] text-green-700">
            {pair?.label_after ?? "After"}
          </p>
          <p className="flex-1 text-3xl leading-relaxed text-slate-800 sm:text-4xl">{afterText}</p>
          {pair?.explanation ? (
            <p className="mt-4 text-lg text-slate-600 sm:text-xl">{pair.explanation}</p>
          ) : null}
        </div>
      </div>
      <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} />
    </div>
  );
}

// ─── Template 7: organizer_full ──────────────────────────────────────────────
// Title at top; graphic organizer fills remaining space (no size cap).

function OrganizerFullTemplate({ slide, accent, accentLighter }: TemplateProps) {
  const organizerType =
    (slide.visual?.fallback_organizer_type as string | undefined) ??
    (slide.visual?.organizer_data?.type as string | undefined);

  return (
    <div className="flex h-full w-full flex-col bg-white px-10 py-8">
      <p className="mb-1 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
        {slide.slideType.replaceAll("_", " ")}
      </p>
      <h1 className="mb-3 text-5xl font-extrabold text-slate-900 sm:text-6xl">{slide.title}</h1>
      {slide.body ? (
        <p className="mb-4 text-xl text-slate-600 sm:text-2xl">{slide.body}</p>
      ) : null}
      {/* Organizer fills remaining space — no h-64 cap */}
      <div className="min-h-0 flex-1">
        <FallbackOrganizer type={organizerType} />
      </div>
      {slide.engagement ? (
        <div
          className="mt-4 shrink-0 rounded-2xl px-5 py-4"
          style={{ backgroundColor: accentLighter, border: `2px solid ${accent}` }}
        >
          <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
            {engagementLabel(slide.engagement.type)}
          </p>
          <p className="text-xl font-semibold text-slate-800 sm:text-2xl">{slide.engagement.prompt}</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Template 8: guided_practice_image ───────────────────────────────────────
// Top 22%: title. Middle 52%: image. Bottom 26%: student action strip.

function GuidedPracticeImageTemplate({ slide, artifactId, accent }: TemplateProps) {
  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header — 22% */}
      <div className="shrink-0 px-12 py-6" style={{ height: "22%" }}>
        <p className="mb-1 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          {slide.title}
        </h1>
      </div>
      {/* Image — 52% */}
      <div className="min-h-0 overflow-hidden px-8" style={{ height: "52%" }}>
        <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
      </div>
      {/* Action strip — 26% */}
      <div
        className="flex shrink-0 flex-col items-start justify-center px-12"
        style={{ height: "26%", backgroundColor: accent }}
      >
        {slide.engagement ? (
          <>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em] text-white/70">
              {engagementLabel(slide.engagement.type)}
            </p>
            <p className="text-2xl font-semibold text-white sm:text-3xl">
              {slide.engagement.prompt}
            </p>
          </>
        ) : slide.body ? (
          <p className="text-2xl font-semibold text-white sm:text-3xl">{slide.body}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Template 9: discussion_image ────────────────────────────────────────────
// Left 56%: question + engagement. Right 44%: image.

function DiscussionImageTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  const questionText = slide.discussionQuestion ?? slide.body ?? slide.title;

  return (
    <div className="flex h-full w-full bg-white">
      {/* Question side */}
      <div className="flex w-[56%] flex-col justify-center px-12 py-10">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          Discussion
        </p>
        <p className="text-3xl font-extrabold leading-snug text-slate-900 sm:text-4xl lg:text-5xl">
          {questionText}
        </p>
        {slide.bullets.length > 0 ? (
          <ul className="mt-5 space-y-2.5">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-xl font-medium text-slate-700 sm:text-2xl"
              >
                <span
                  className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} dark />
      </div>
      {/* Image side */}
      <div className="w-[44%] p-8 pl-0">
        <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
      </div>
    </div>
  );
}

// ─── Template 10: exit_ticket_image ──────────────────────────────────────────
// Accent header band, then left: question, right: image.

function ExitTicketImageTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header band */}
      <div
        className="flex shrink-0 items-center px-10"
        style={{ backgroundColor: accent, height: "12%" }}
      >
        <h2 className="text-2xl font-black uppercase tracking-[0.22em] text-white sm:text-3xl">
          Exit Ticket
        </h2>
      </div>
      {/* Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Question side */}
        <div className="flex w-[58%] flex-col justify-center px-12 py-8">
          <p className="text-3xl font-extrabold leading-snug text-slate-900 sm:text-4xl lg:text-5xl">
            {slide.body ?? slide.title}
          </p>
          {slide.bullets.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {slide.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-xl font-medium text-slate-700 sm:text-2xl"
                >
                  <span
                    className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {slide.engagement ? (
            <div
              className="mt-6 rounded-2xl px-5 py-4"
              style={{ backgroundColor: accentLighter, border: `2px solid ${accent}` }}
            >
              <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
                {engagementLabel(slide.engagement.type)}
              </p>
              <p className="text-xl font-semibold text-slate-800 sm:text-2xl">{slide.engagement.prompt}</p>
            </div>
          ) : (
            <p className="mt-6 text-2xl font-semibold text-slate-500 sm:text-3xl">
              ✏️ Write your answer below
            </p>
          )}
        </div>
        {/* Image side */}
        <div className="w-[42%] p-8 pl-0">
          <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Legacy fallback: image_left_text_right ───────────────────────────────────

function ImageLeftTextRightTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  return (
    <div className="flex h-full w-full items-center bg-white">
      <div className="w-[45%] p-8 pr-4">
        <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
      </div>
      <div className="flex w-[55%] flex-col justify-center px-10 py-10">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-5xl font-extrabold leading-tight text-slate-900 sm:text-6xl">
          {slide.title}
        </h1>
        {slide.body ? (
          <p className="mt-4 text-[2rem] leading-relaxed text-slate-700 sm:text-[2.25rem]">{slide.body}</p>
        ) : null}
        {slide.bullets.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl px-5 py-3.5 text-2xl font-medium text-slate-800 sm:text-3xl"
                style={{ backgroundColor: accentLighter }}
              >
                <span
                  className="mt-2.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} />
      </div>
    </div>
  );
}

// ─── Default fallback: text_left_image_right ──────────────────────────────────

function TextLeftImageRightTemplate({ slide, artifactId, accent, accentLighter }: TemplateProps) {
  return (
    <div className="flex h-full w-full items-center bg-white">
      <div className="flex w-[55%] flex-col justify-center px-12 py-10">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {slide.slideType.replaceAll("_", " ")}
        </p>
        <h1 className="text-5xl font-extrabold leading-tight text-slate-900 sm:text-6xl lg:text-[4.5rem]">
          {slide.title}
        </h1>
        {slide.body ? (
          <p className="mt-4 text-[2rem] leading-relaxed text-slate-700 sm:text-[2.25rem]">{slide.body}</p>
        ) : null}
        {slide.bullets.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl px-5 py-3.5 text-2xl font-medium text-slate-800 sm:text-3xl"
                style={{ backgroundColor: accentLighter }}
              >
                <span
                  className="mt-2.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <EngagementBlock engagement={slide.engagement} accent={accent} accentLighter={accentLighter} />
      </div>
      <div className="w-[45%] p-8 pl-0">
        <SlideImage slide={slide} artifactId={artifactId} accent={accent} className="h-full w-full" />
      </div>
    </div>
  );
}

// ─── Layout router ────────────────────────────────────────────────────────────

function resolveLayout(slide: TeachingPresentationSlide): string {
  const explicit = slide.layout;
  if (explicit) return explicit;
  switch (slide.slideType) {
    case "hook":                 return "hook_full_image";
    case "connection":           return "hook_full_image";
    case "today_we_learn":       return "objective_image";
    case "vocabulary":           return "vocabulary_showcase";
    case "word_study":           return "vocabulary_showcase";
    case "concept":              return "teacher_modeling";
    case "teaching_point":       return "teacher_modeling";
    case "example":              return "before_after";
    case "discussion":           return "discussion_image";
    case "your_turn":            return "guided_practice_image";
    case "active_engagement":    return "guided_practice_image";
    case "guided_practice":      return "guided_practice_image";
    case "independent_practice": return "guided_practice_image";
    case "check_in":             return "exit_ticket_image";
    case "exit_ticket":          return "exit_ticket_image";
    case "read_aloud":           return "text_left_image_right";
    case "wrap_up":              return "title_full";
    case "share":                return "title_full";
    default:                     return "text_left_image_right";
  }
}

function SlideRenderer(props: TemplateProps) {
  const layout = resolveLayout(props.slide);

  switch (layout) {
    case "title_full":
    case "full_image_caption":
      return <TitleFullTemplate {...props} />;

    case "objective_image":
      return <ObjectiveImageTemplate {...props} />;

    case "vocabulary_showcase":
    case "vocabulary_image_card":
      return <VocabularyShowcaseTemplate {...props} />;

    case "hook_full_image":
    case "image_top_text_bottom":
      return <HookFullImageTemplate {...props} />;

    case "teacher_modeling":
      return <TeacherModelingTemplate {...props} />;

    case "before_after":
    case "comparison_with_images":
      return <BeforeAfterTemplate {...props} />;

    case "organizer_full":
    case "graphic_organizer":
      return <OrganizerFullTemplate {...props} />;

    case "guided_practice_image":
    case "question_with_image":
      return <GuidedPracticeImageTemplate {...props} />;

    case "discussion_image":
      return <DiscussionImageTemplate {...props} />;

    case "exit_ticket_image":
      return <ExitTicketImageTemplate {...props} />;

    case "image_left_text_right":
      return <ImageLeftTextRightTemplate {...props} />;

    case "text_left_image_right":
    default:
      return <TextLeftImageRightTemplate {...props} />;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

type StudentLessonPresentationProps = {
  packageTitle: string;
  presentationTitle: string;
  artifactId: string;
  slides: TeachingPresentationSlide[];
  onExit: () => void;
};

export function StudentLessonPresentation({
  packageTitle: _packageTitle,
  presentationTitle: _presentationTitle,
  artifactId,
  slides,
  onExit,
}: StudentLessonPresentationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTeacherNotes, setShowTeacherNotes] = useState(false);

  const currentSlide = slides[currentIndex];
  const total = slides.length;

  const goNext = useCallback(() => {
    setCurrentIndex((v) => Math.min(v + 1, total - 1));
  }, [total]);

  const goPrevious = useCallback(() => {
    setCurrentIndex((v) => Math.max(v - 1, 0));
  }, []);

  const requestFullscreen = useCallback(async () => {
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
    void requestFullscreen();
  }, [requestFullscreen]);

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
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setShowTeacherNotes((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious, onExit]);

  if (!currentSlide) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-700">No slides available.</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-slate-800 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={onExit}
          >
            Exit
          </button>
        </div>
      </div>
    );
  }

  const accent = accentHex(currentSlide.slideType);
  const accentLighter = accentLight(currentSlide.slideType);
  const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 100;

  return (
    <div ref={containerRef} className="group relative flex min-h-dvh overflow-hidden bg-white">
      {/* Slide fills the entire screen; key forces full remount on slide change */}
      <div key={currentSlide.id} className="absolute inset-0">
        <SlideRenderer
          slide={currentSlide}
          artifactId={artifactId}
          accent={accent}
          accentLighter={accentLighter}
        />
      </div>

      {/* Teacher notes overlay — activated by T key; never visible by default */}
      {showTeacherNotes && currentSlide.teacherNotes ? (
        <div className="absolute bottom-0 left-0 right-0 z-30 max-h-[30%] overflow-y-auto bg-black/80 px-8 py-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">Teacher Notes</p>
                {currentSlide.studentEmotion ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white/70">
                    {currentSlide.studentEmotion}
                  </span>
                ) : null}
              </div>
              <p className="text-base leading-relaxed text-white/90 sm:text-lg">{currentSlide.teacherNotes}</p>
              {currentSlide.visualLearningGoal ? (
                <p className="mt-2 text-sm italic text-white/55">{currentSlide.visualLearningGoal}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 text-white/40 hover:text-white/70 transition"
              onClick={() => setShowTeacherNotes(false)}
              aria-label="Close teacher notes"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {/* Overlay controls — pointer-events-none except on the interactive elements */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {/* Previous — left edge */}
        <div className="absolute bottom-0 left-0 top-0 flex items-center pl-3">
          <button
            type="button"
            className="pointer-events-auto flex h-20 w-12 items-center justify-center rounded-2xl bg-black/20 text-2xl font-bold text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-black/45 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100"
            disabled={currentIndex === 0}
            onClick={goPrevious}
            aria-label="Previous slide"
          >
            ←
          </button>
        </div>

        {/* Next — right edge */}
        <div className="absolute bottom-0 right-0 top-0 flex items-center pr-3">
          <button
            type="button"
            className="pointer-events-auto flex h-20 w-12 items-center justify-center rounded-2xl bg-black/20 text-2xl font-bold text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-black/45 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100"
            disabled={currentIndex >= total - 1}
            onClick={goNext}
            aria-label="Next slide"
          >
            →
          </button>
        </div>

        {/* Top-right: slide counter + exit */}
        <div className="absolute right-4 top-4 flex items-center gap-2 pointer-events-auto">
          <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {currentIndex + 1} / {total}
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-black/55"
            onClick={onExit}
            aria-label="Exit presentation"
          >
            ✕
          </button>
        </div>

        {/* Bottom-left: teacher notes toggle (T key) — visible on hover only */}
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-xs font-bold text-white/60 backdrop-blur-sm transition hover:bg-black/45 hover:text-white opacity-0 group-hover:opacity-100"
            onClick={() => setShowTeacherNotes((v) => !v)}
            aria-label={showTeacherNotes ? "Hide teacher notes" : "Show teacher notes (T)"}
            title="Teacher notes (T)"
          >
            T
          </button>
        </div>

        {/* Bottom: thin progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
      </div>
    </div>
  );
}
