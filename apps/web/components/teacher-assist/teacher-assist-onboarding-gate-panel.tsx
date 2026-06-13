"use client";

import Link from "next/link";

import { useTeacherAssistOnboarding } from "@/components/teacher-assist/teacher-assist-onboarding-context";

type Props = {
  title?: string;
  description?: string;
  className?: string;
};

export function TeacherAssistOnboardingGatePanel({
  title = "Finish setup to unlock this workflow",
  description = "Complete school & district setup, school year, and your homeroom before creating plans, pacing guides, assignments, and other classroom workflows.",
  className = "",
}: Props) {
  const { progressPercent } = useTeacherAssistOnboarding();

  return (
    <section className={`ta-panel p-6 ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Setup required</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
      <p className="mt-3 text-sm font-medium text-slate-700">Current progress: {progressPercent}%</p>
      <Link href="/teacher-assist/get-started" className="ta-button-primary mt-4 inline-flex">
        Continue onboarding
      </Link>
    </section>
  );
}
