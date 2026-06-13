"use client";

import type { TeacherAssistAiGenerationStatus } from "@/lib/teacher-assist-v2-types";

type Props = {
  status: TeacherAssistAiGenerationStatus | null | undefined;
};

export function TeacherAssistV2AiModeBanner({ status }: Props) {
  if (!status) return null;

  const isReal = status.ai_mode === "real_openai";
  const toneClass = isReal
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div className={`ta-panel border px-4 py-3 text-sm ${toneClass}`}>
      <p className="font-semibold">AI Mode: {isReal ? "Real AI Enabled" : "Mock Mode"}</p>
      <p className="mt-1">{status.banner_message}</p>
    </div>
  );
}
