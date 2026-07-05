"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  fetchTeacherAssistV2Context,
  pollV2AssignmentGradingCount,
  pollV2PackageStatus,
} from "@/lib/teacher-assist-v2-api";
import type { TeacherAssistV2Context } from "@/lib/teacher-assist-v2-types";

type ProcessingIndicator = {
  kind: "package" | "grading";
  targetId: string;
  label: string;
};

type Ctx = {
  context: TeacherAssistV2Context | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  processingIndicator: ProcessingIndicator | null;
  setProcessingIndicator: (indicator: ProcessingIndicator) => void;
  clearProcessingIndicator: (targetId?: string) => void;
};

const TeacherAssistV2ContextReact = createContext<Ctx | null>(null);
const PROCESSING_STORAGE_KEY = "teacher-assist-v2-processing";

export function TeacherAssistV2Provider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<TeacherAssistV2Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIndicator, setProcessingIndicatorState] = useState<ProcessingIndicator | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContext(await fetchTeacherAssistV2Context());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load TeacherAssist context.");
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(PROCESSING_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ProcessingIndicator;
      if (parsed?.kind && parsed?.targetId && parsed?.label) {
        setProcessingIndicatorState(parsed);
      }
    } catch {
      window.sessionStorage.removeItem(PROCESSING_STORAGE_KEY);
    }
  }, []);

  const setProcessingIndicator = useCallback((indicator: ProcessingIndicator) => {
    setProcessingIndicatorState(indicator);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PROCESSING_STORAGE_KEY, JSON.stringify(indicator));
    }
  }, []);

  const clearProcessingIndicator = useCallback((targetId?: string) => {
    setProcessingIndicatorState((current) => {
      if (targetId && current?.targetId !== targetId) {
        return current;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PROCESSING_STORAGE_KEY);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!processingIndicator) return;
    const poll = async () => {
      try {
        if (processingIndicator.kind === "package") {
          const status = await pollV2PackageStatus(processingIndicator.targetId);
          // null = auth/network error; keep polling. "processing" = still running.
          if (status !== null && status !== "processing") {
            clearProcessingIndicator(processingIndicator.targetId);
          }
          return;
        }
        const processingCount = await pollV2AssignmentGradingCount(processingIndicator.targetId);
        // null = auth/network error; keep polling silently.
        if (processingCount !== null && processingCount === 0) {
          clearProcessingIndicator(processingIndicator.targetId);
        }
      } catch (err) {
        // Clear on 404 (package/assignment deleted); keep indicator for all other errors.
        if (err instanceof Error && err.message.includes("404")) {
          clearProcessingIndicator(processingIndicator.targetId);
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [clearProcessingIndicator, processingIndicator]);

  const value = useMemo(
    () => ({
      context,
      loading,
      error,
      refresh,
      processingIndicator,
      setProcessingIndicator,
      clearProcessingIndicator,
    }),
    [clearProcessingIndicator, context, error, loading, processingIndicator, refresh, setProcessingIndicator],
  );

  return <TeacherAssistV2ContextReact.Provider value={value}>{children}</TeacherAssistV2ContextReact.Provider>;
}

export function useTeacherAssistV2() {
  const ctx = useContext(TeacherAssistV2ContextReact);
  if (!ctx) throw new Error("useTeacherAssistV2 must be used within TeacherAssistV2Provider");
  return ctx;
}
