"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";

export function TeacherAssistV2LandingRedirect() {
  const router = useRouter();
  const { context, loading } = useTeacherAssistV2();

  useEffect(() => {
    if (loading || !context) return;
    router.replace(context.landing_route);
  }, [context, loading, router]);

  return <p className="text-sm text-slate-600">Redirecting...</p>;
}
