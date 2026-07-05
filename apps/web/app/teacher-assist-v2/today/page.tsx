"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { TeacherAssistV2TodayScreen } from "@/components/teacher-assist-v2/teacher-assist-v2-today-screen";
import type { TodayClassroom } from "@/lib/teacher-assist-v2-types";

export default function TeacherAssistV2TodayPage() {
  const router = useRouter();
  // Built from loaded data so artifact/recovery clicks can resolve to a package/assignment.
  const artifactPackageMapRef = useRef<Map<string, string>>(new Map());
  const recoveryAssignmentMapRef = useRef<Map<string, string>>(new Map());

  const handleDataLoaded = useCallback((data: TodayClassroom) => {
    const artifactMap = new Map<string, string>();
    for (const subject of data.subjects_today) {
      for (const ref of Object.values(subject.artifacts)) {
        artifactMap.set(ref.artifact_id, subject.package_id);
      }
    }
    artifactPackageMapRef.current = artifactMap;

    const recoveryMap = new Map<string, string>();
    for (const item of data.recovery_today) {
      if (item.assignment_id) {
        recoveryMap.set(item.queue_item_id, item.assignment_id);
      }
    }
    for (const subject of data.subjects_today) {
      for (const item of subject.recovery_items) {
        if (item.assignment_id) {
          recoveryMap.set(item.queue_item_id, item.assignment_id);
        }
      }
    }
    recoveryAssignmentMapRef.current = recoveryMap;
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
    (queueItemId: string) => {
      const assignmentId = recoveryAssignmentMapRef.current.get(queueItemId);
      if (assignmentId) {
        router.push(`/teacher-assist-v2/assignments/view?id=${encodeURIComponent(assignmentId)}`);
      } else {
        router.push("/teacher-assist-v2/assignments");
      }
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
