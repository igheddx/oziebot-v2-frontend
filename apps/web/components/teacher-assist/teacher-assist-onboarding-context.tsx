"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fetchTeacherAssistHomeWorkspace } from "@/lib/teacher-assist-api";
import type { TeacherAssistOnboardingProgress } from "@/lib/teacher-assist-types";

type TeacherAssistOnboardingContextValue = {
  loading: boolean;
  onboarding: TeacherAssistOnboardingProgress | null;
  isComplete: boolean;
  progressPercent: number;
};

const TeacherAssistOnboardingContext = createContext<TeacherAssistOnboardingContextValue>({
  loading: true,
  onboarding: null,
  isComplete: false,
  progressPercent: 0,
});

export function TeacherAssistOnboardingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<TeacherAssistOnboardingProgress | null>(null);

  useEffect(() => {
    let active = true;
    fetchTeacherAssistHomeWorkspace()
      .then((payload) => {
        if (active) setOnboarding(payload.onboarding);
      })
      .catch(() => {
        if (active) setOnboarding(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      onboarding,
      isComplete: onboarding?.is_complete ?? false,
      progressPercent: onboarding?.progress_percent ?? 0,
    }),
    [loading, onboarding],
  );

  return (
    <TeacherAssistOnboardingContext.Provider value={value}>{children}</TeacherAssistOnboardingContext.Provider>
  );
}

export function useTeacherAssistOnboarding() {
  return useContext(TeacherAssistOnboardingContext);
}
