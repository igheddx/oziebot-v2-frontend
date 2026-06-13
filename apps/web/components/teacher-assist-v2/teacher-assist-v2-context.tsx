"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fetchTeacherAssistV2Context } from "@/lib/teacher-assist-v2-api";
import type { TeacherAssistV2Context } from "@/lib/teacher-assist-v2-types";

type Ctx = {
  context: TeacherAssistV2Context | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const TeacherAssistV2ContextReact = createContext<Ctx | null>(null);

export function TeacherAssistV2Provider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<TeacherAssistV2Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
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
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({ context, loading, error, refresh }), [context, loading, error]);

  return <TeacherAssistV2ContextReact.Provider value={value}>{children}</TeacherAssistV2ContextReact.Provider>;
}

export function useTeacherAssistV2() {
  const ctx = useContext(TeacherAssistV2ContextReact);
  if (!ctx) throw new Error("useTeacherAssistV2 must be used within TeacherAssistV2Provider");
  return ctx;
}
