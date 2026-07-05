"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { TeacherAssistV2TodayScreen } from "@/components/teacher-assist-v2/teacher-assist-v2-today-screen";
import type { TodayClassroom } from "@/lib/teacher-assist-v2-types";

export default function TeacherAssistV2TodayPage() {
  const router = useRouter();
  // Built from loaded data so artifact clicks can resolve to a package.
  const artifactPackageMapRef = useRef<Map<string, string>>(new Map());

  const handleDataLoaded = useCallback((data: TodayClassroom) => {
    const map = new Map<string, string>();
    for (const subject of data.subjects_today) {
      for (const ref of Object.values(subject.artifacts)) {
        map.set(ref.artifact_id, subject.package_id);
      }
    }
    artifactPackageMapRef.current = map;
  }, []);

  const handleArtifactClick = useCallback(
    (artifactId: string) => {
      const packageId = artifactPackageMapRef.current.get(artifactId);
      if (packageId) {
        router.push(`/teacher-assist-v2/teach?packageId=${packageId}`);
      } else {
        router.push("/teacher-assist-v2/packages");
      }
    },
    [router],
  );

  const handleGradeClick = useCallback(
    (assignmentId: string) => {
      router.push(`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(assignmentId)}`);
    },
    [router],
  );

  const handleRecoveryClick = useCallback(
    (_queueItemId: string) => {
      router.push("/teacher-assist-v2/assignments");
    },
    [router],
  );

  return (
    <TeacherAssistV2TodayScreen
      onDataLoaded={handleDataLoaded}
      onArtifactClick={handleArtifactClick}
      onGradeClick={handleGradeClick}
      onRecoveryClick={handleRecoveryClick}
    />
  );
}
