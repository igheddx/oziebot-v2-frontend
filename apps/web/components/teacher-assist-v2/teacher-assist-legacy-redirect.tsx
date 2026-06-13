"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TeacherAssistLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher-assist-v2");
  }, [router]);

  return (
    <div className="teacher-assist-theme mx-auto flex min-h-dvh max-w-lg items-center justify-center px-6">
      <p className="text-sm text-slate-600">Redirecting to TeacherAssist v2...</p>
    </div>
  );
}
