export type TeacherAssistV2NavItem = {
  href: string;
  label: string;
};

export const TEACHER_ASSIST_V2_ROOT_ADMIN_NAV: TeacherAssistV2NavItem[] = [
  { href: "/teacher-assist-v2/admin", label: "Dashboard" },
  { href: "/teacher-assist-v2/admin/states", label: "State Management" },
  { href: "/teacher-assist-v2/admin/districts", label: "District Management" },
  { href: "/teacher-assist-v2/admin/schools", label: "School Management" },
  { href: "/teacher-assist-v2/admin/grades", label: "Grade Management" },
  { href: "/teacher-assist-v2/admin/subjects", label: "Subject Management" },
  { href: "/teacher-assist-v2/admin/school-years", label: "School Years" },
  { href: "/teacher-assist-v2/admin/objectives", label: "Learning Objectives" },
  { href: "/teacher-assist-v2/admin/pacing-guides", label: "Pacing Guides" },
  { href: "/teacher-assist-v2/admin/teachers", label: "Teachers" },
  { href: "/teacher-assist-v2/admin/hierarchy", label: "Hierarchy Explorer" },
  { href: "/teacher-assist-v2/admin/ai-settings", label: "AI Settings" },
  { href: "/teacher-assist-v2/admin/settings", label: "Settings" },
];

export const TEACHER_ASSIST_V2_TEACHER_NAV: TeacherAssistV2NavItem[] = [
  { href: "/teacher-assist-v2/today", label: "Today" },
  { href: "/teacher-assist-v2/planning", label: "Planning" },
  { href: "/teacher-assist-v2/packages", label: "Packages" },
  { href: "/teacher-assist-v2/assignments", label: "Assignments" },
  { href: "/teacher-assist-v2/gradebook", label: "Gradebook" },
  { href: "/teacher-assist-v2/mastery", label: "Mastery" },
];
