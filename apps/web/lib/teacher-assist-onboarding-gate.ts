import type { TeacherAssistNavLink } from "@/components/teacher-assist/teacher-assist-nav";

/** Teacher workflow routes that require catalog + classroom setup before use. */
export const TEACHER_ASSIST_ONBOARDING_GATED_HREFS = new Set<string>([
  "/teacher-assist/planning/pacing-guides/workspace",
  "/teacher-assist/planning/weeks",
  "/teacher-assist/pacing-guides",
  "/teacher-assist/resources",
  "/teacher-assist/assignments",
  "/teacher-assist/mastery",
  "/teacher-assist/newsletters",
  "/teacher-assist/copilot",
  "/teacher-assist/work-queue",
  "/teacher-assist/planning/templates",
  "/teacher-assist/catalog",
  "/teacher-assist/plans",
  "/teacher-assist/weekly-planning",
  "/teacher-assist/extractions",
  "/teacher-assist/gradebook",
  "/teacher-assist/reteach",
  "/teacher-assist/reteach-plans",
  "/teacher-assist/reflections",
  "/teacher-assist/actions",
  "/teacher-assist/exports",
  "/teacher-assist/communication",
  "/teacher-assist/curriculum-rollover",
  "/teacher-assist/plan-library",
]);

export function teacherAssistHrefRequiresOnboarding(href: string): boolean {
  if (
    href === "/teacher-assist/home" ||
    href === "/teacher-assist/get-started" ||
    href === "/teacher-assist/settings"
  ) {
    return false;
  }
  if (href.startsWith("/teacher-assist/administration")) {
    return false;
  }
  if (href.startsWith("/teacher-assist/feedback")) {
    return false;
  }
  for (const gated of TEACHER_ASSIST_ONBOARDING_GATED_HREFS) {
    if (href === gated || href.startsWith(`${gated}/`)) {
      return true;
    }
  }
  return false;
}

export function filterQuickCreateLinks(links: TeacherAssistNavLink[], onboardingComplete: boolean) {
  if (onboardingComplete) return links;
  return [];
}
