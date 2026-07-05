import { authFetch, buildApiUrl, getStoredAccessToken, parseErrorMessage, refreshTokens } from "@/lib/auth-service";
import type {
  AdminDashboard,
  ArchiveCheck,
  EducationDistrictRow,
  EducationGradeRow,
  EducationObjectiveRow,
  EducationSchoolRow,
  EducationSchoolYearRow,
  EducationStateRow,
  EducationSubjectRow,
  HierarchyStateNode,
  PacingGuideBuilderPayload,
  PacingGuideDetail,
  PacingGuideSummary,
  PacingGuideSupportingMaterial,
  AdminGoogleSettings,
  AssignmentGoogleForm,
  GoogleFormsConnectionStatus,
  InstructionalPackageDetail,
  InstructionalPackageSummary,
  PackageAdditionalAssignmentForm,
  PackageRubricCriterion,
  AssignmentDetail,
  AssignmentSummary,
  ManualAssignmentForm,
  ManualAssignmentObjective,
  StudentSubmissionDetail,
  StudentSubmissionSummary,
  GradingDraft,
  GradingJob,
  AssignmentGrade,
  GradeAuditEvent,
  GradeReviewRow,
  SubmissionBatch,
  PlanningForm,
  PlanningReview,
  PlanningSupplementalMaterial,
  TeacherAssistV2Context,
  TeacherAssistAiAdminConfig,
  TeacherAssistAiProviderConfigInput,
  TeacherAssistAiGenerationStatus,
  TeacherAiReadiness,
  AdminTeacherRow,
  PacingGuideSetupForm,
  TeacherHomeSummary,
  GradebookRecord,
  GradebookGrid,
  GradebookGridForm,
  MasteryEvidenceRow,
  TeacherOnboardingForm,
  TeacherProvisionResult,
  ClassInsight,
  StudentFacingFeedback,
  RecoveryQueueItem,
  RecoveryBudget,
  RecoveryDecision,
  RecoveryArtifact,
  TodayClassroom,
} from "@/lib/teacher-assist-v2-types";

export class ApiFieldErrors extends Error {
  fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("Validation failed");
    this.name = "ApiFieldErrors";
    this.fieldErrors = fieldErrors;
  }
}

function parseApiFailure(response: Response, payload: unknown): never {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (detail && typeof detail === "object" && "field_errors" in detail) {
      throw new ApiFieldErrors((detail as { field_errors: Record<string, string> }).field_errors);
    }
    if (typeof detail === "string") {
      throw new Error(detail);
    }
  }
  throw new Error(`Request failed (${response.status})`);
}

async function readJson<T>(path: string): Promise<T> {
  const response = await authFetch(path);
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function writeJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await authFetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    try {
      const payload = await response.json();
      parseApiFailure(response, payload);
    } catch (error) {
      if (error instanceof ApiFieldErrors || error instanceof Error) throw error;
      throw new Error(`Request failed (${response.status})`);
    }
  }
  return (await response.json()) as T;
}

export function fetchTeacherAssistV2Context() {
  return readJson<TeacherAssistV2Context>("/v1/teacher-assist-v2/context");
}

export function fetchV2AdminDashboard() {
  return readJson<AdminDashboard>("/v1/teacher-assist-v2/admin/dashboard");
}

export function fetchV2AdminAiProviderConfig() {
  return readJson<TeacherAssistAiAdminConfig>("/v1/teacher-assist-v2/admin/ai-provider-config");
}

export function updateV2AdminAiProviderConfig(body: TeacherAssistAiProviderConfigInput) {
  return writeJson<TeacherAssistAiAdminConfig>("/v1/teacher-assist-v2/admin/ai-provider-config", "PUT", body);
}

export function testV2AdminAiProviderConnection() {
  return writeJson<{ success: boolean; message: string; model?: string }>(
    "/v1/teacher-assist-v2/admin/ai-provider-config/test-connection",
    "POST",
  );
}

export function fetchV2TeacherAiGenerationStatus() {
  return readJson<TeacherAssistAiGenerationStatus>("/v1/teacher-assist-v2/teacher/ai-generation-status");
}

export function fetchV2TeacherAiReadiness() {
  return readJson<TeacherAiReadiness>("/v1/teacher-assist-v2/teacher/ai-readiness");
}

export function fetchV2States(activeOnly = false) {
  return readJson<EducationStateRow[]>(`/v1/teacher-assist-v2/catalog/states?active_only=${activeOnly}`);
}

export function createV2State(body: { name: string; abbreviation: string; active?: boolean }) {
  return writeJson<EducationStateRow>("/v1/teacher-assist-v2/catalog/states", "POST", body);
}

export function updateV2State(id: string, body: { name: string; abbreviation: string; active?: boolean }) {
  return writeJson<EducationStateRow>(`/v1/teacher-assist-v2/catalog/states/${id}`, "PUT", body);
}

export function archiveV2State(id: string) {
  return writeJson<EducationStateRow>(`/v1/teacher-assist-v2/catalog/states/${id}/archive`, "POST");
}

export function checkArchiveV2State(id: string) {
  return readJson<ArchiveCheck>(`/v1/teacher-assist-v2/catalog/states/${id}/archive-check`);
}

export function fetchV2Districts(stateId?: string, activeOnly = false) {
  const params = new URLSearchParams();
  if (stateId) params.set("state_id", stateId);
  if (activeOnly) params.set("active_only", "true");
  const query = params.toString();
  return readJson<EducationDistrictRow[]>(`/v1/teacher-assist-v2/catalog/districts${query ? `?${query}` : ""}`);
}

export function createV2District(body: {
  state_id: string;
  name: string;
  district_code?: string | null;
  active?: boolean;
}) {
  return writeJson<EducationDistrictRow>("/v1/teacher-assist-v2/catalog/districts", "POST", body);
}

export function updateV2District(
  id: string,
  body: { state_id: string; name: string; district_code?: string | null; active?: boolean },
) {
  return writeJson<EducationDistrictRow>(`/v1/teacher-assist-v2/catalog/districts/${id}`, "PUT", body);
}

export function archiveV2District(id: string) {
  return writeJson<EducationDistrictRow>(`/v1/teacher-assist-v2/catalog/districts/${id}/archive`, "POST");
}

export function fetchV2Schools(districtId?: string, activeOnly = false) {
  const params = new URLSearchParams();
  if (districtId) params.set("district_id", districtId);
  if (activeOnly) params.set("active_only", "true");
  const query = params.toString();
  return readJson<EducationSchoolRow[]>(`/v1/teacher-assist-v2/catalog/schools${query ? `?${query}` : ""}`);
}

export function createV2School(body: {
  district_id: string;
  name: string;
  school_type?: string | null;
  active?: boolean;
}) {
  return writeJson<EducationSchoolRow>("/v1/teacher-assist-v2/catalog/schools", "POST", body);
}

export function updateV2School(
  id: string,
  body: { district_id: string; name: string; school_type?: string | null; active?: boolean },
) {
  return writeJson<EducationSchoolRow>(`/v1/teacher-assist-v2/catalog/schools/${id}`, "PUT", body);
}

export function archiveV2School(id: string) {
  return writeJson<EducationSchoolRow>(`/v1/teacher-assist-v2/catalog/schools/${id}/archive`, "POST");
}

export function fetchV2Grades(schoolId?: string, activeOnly = false) {
  const params = new URLSearchParams();
  if (schoolId) params.set("school_id", schoolId);
  if (activeOnly) params.set("active_only", "true");
  const query = params.toString();
  return readJson<EducationGradeRow[]>(`/v1/teacher-assist-v2/catalog/grades${query ? `?${query}` : ""}`);
}

export function createV2Grade(body: {
  school_id: string | null;
  grade_code: string;
  display_name: string;
  active?: boolean;
}) {
  return writeJson<EducationGradeRow>("/v1/teacher-assist-v2/catalog/grades", "POST", body);
}

export function updateV2Grade(
  id: string,
  body: { school_id: string | null; grade_code: string; display_name: string; active?: boolean },
) {
  return writeJson<EducationGradeRow>(`/v1/teacher-assist-v2/catalog/grades/${id}`, "PUT", body);
}

export function archiveV2Grade(id: string) {
  return writeJson<EducationGradeRow>(`/v1/teacher-assist-v2/catalog/grades/${id}/archive`, "POST");
}

export function fetchV2Subjects(gradeId?: string, activeOnly = false) {
  const params = new URLSearchParams();
  if (gradeId) params.set("grade_id", gradeId);
  if (activeOnly) params.set("active_only", "true");
  const query = params.toString();
  return readJson<EducationSubjectRow[]>(`/v1/teacher-assist-v2/catalog/subjects${query ? `?${query}` : ""}`);
}

export function createV2Subject(body: {
  grade_id: string;
  subject_code: string;
  display_name: string;
  active?: boolean;
}) {
  return writeJson<EducationSubjectRow>("/v1/teacher-assist-v2/catalog/subjects", "POST", body);
}

export function updateV2Subject(
  id: string,
  body: { grade_id: string; subject_code: string; display_name: string; active?: boolean },
) {
  return writeJson<EducationSubjectRow>(`/v1/teacher-assist-v2/catalog/subjects/${id}`, "PUT", body);
}

export function archiveV2Subject(id: string) {
  return writeJson<EducationSubjectRow>(`/v1/teacher-assist-v2/catalog/subjects/${id}/archive`, "POST");
}

export function fetchV2Hierarchy(activeOnly = true) {
  return readJson<HierarchyStateNode[]>(`/v1/teacher-assist-v2/admin/hierarchy?active_only=${activeOnly}`);
}

export function fetchV2SchoolYears(stateId?: string, activeOnly = false) {
  const params = new URLSearchParams();
  if (stateId) params.set("state_id", stateId);
  if (activeOnly) params.set("active_only", "true");
  const query = params.toString();
  return readJson<EducationSchoolYearRow[]>(
    `/v1/teacher-assist-v2/instructional/school-years${query ? `?${query}` : ""}`,
  );
}

export function createV2SchoolYear(body: {
  state_id: string;
  district_id?: string | null;
  school_id?: string | null;
  title: string;
  start_date: string;
  end_date: string;
  active?: boolean;
}) {
  return writeJson<EducationSchoolYearRow>("/v1/teacher-assist-v2/instructional/school-years", "POST", body);
}

export function updateV2SchoolYear(
  id: string,
  body: {
    state_id: string;
    district_id?: string | null;
    school_id?: string | null;
    title: string;
    start_date: string;
    end_date: string;
    active?: boolean;
  },
) {
  return writeJson<EducationSchoolYearRow>(`/v1/teacher-assist-v2/instructional/school-years/${id}`, "PUT", body);
}

export function archiveV2SchoolYear(id: string) {
  return writeJson<EducationSchoolYearRow>(`/v1/teacher-assist-v2/instructional/school-years/${id}/archive`, "POST");
}

export function fetchV2Objectives(filters?: {
  state_id?: string;
  grade_id?: string;
  subject_id?: string;
  school_year_id?: string;
  active_only?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.state_id) params.set("state_id", filters.state_id);
  if (filters?.grade_id) params.set("grade_id", filters.grade_id);
  if (filters?.subject_id) params.set("subject_id", filters.subject_id);
  if (filters?.school_year_id) params.set("school_year_id", filters.school_year_id);
  if (filters?.active_only) params.set("active_only", "true");
  const query = params.toString();
  return readJson<EducationObjectiveRow[]>(
    `/v1/teacher-assist-v2/instructional/objectives${query ? `?${query}` : ""}`,
  );
}

export function createV2Objective(body: {
  state_id: string;
  district_id?: string | null;
  school_id?: string | null;
  grade_id: string;
  subject_id: string;
  school_year_id: string;
  objective_type: string;
  objective_id: string;
  description: string;
  is_required?: boolean;
  active?: boolean;
}) {
  return writeJson<EducationObjectiveRow>("/v1/teacher-assist-v2/instructional/objectives", "POST", body);
}

export function updateV2Objective(id: string, body: Parameters<typeof createV2Objective>[0]) {
  return writeJson<EducationObjectiveRow>(`/v1/teacher-assist-v2/instructional/objectives/${id}`, "PUT", body);
}

export function archiveV2Objective(id: string) {
  return writeJson<EducationObjectiveRow>(`/v1/teacher-assist-v2/instructional/objectives/${id}/archive`, "POST");
}

export function fetchV2PacingGuides(districtId?: string, gradeId?: string) {
  const params = new URLSearchParams();
  if (districtId) params.set("catalog_district_id", districtId);
  if (gradeId) params.set("catalog_grade_id", gradeId);
  const query = params.toString();
  return readJson<PacingGuideSummary[]>(
    `/v1/teacher-assist-v2/instructional/pacing-guides${query ? `?${query}` : ""}`,
  );
}

export function fetchV2PacingGuide(id: string) {
  return readJson<PacingGuideDetail>(`/v1/teacher-assist-v2/instructional/pacing-guides/${id}`);
}

export function createV2PacingGuideBuilder(body: PacingGuideBuilderPayload) {
  return writeJson<PacingGuideDetail>("/v1/teacher-assist-v2/instructional/pacing-guides/builder", "POST", body);
}

export function updateV2PacingGuideBuilder(id: string, body: PacingGuideBuilderPayload) {
  return writeJson<PacingGuideDetail>(
    `/v1/teacher-assist-v2/instructional/pacing-guides/${id}/builder`,
    "PUT",
    body,
  );
}

export function cloneV2PacingGuide(id: string, body: { title?: string; school_year_id?: string }) {
  return writeJson<PacingGuideDetail>(`/v1/teacher-assist-v2/instructional/pacing-guides/${id}/clone`, "POST", body);
}

export function archiveV2PacingGuide(id: string) {
  return writeJson<PacingGuideSummary>(`/v1/teacher-assist-v2/instructional/pacing-guides/${id}/archive`, "POST");
}

export function updateV2PacingGuidePeriod(periodId: string, body: { title: string; description?: string | null }) {
  return writeJson<PacingGuideDetail>(`/v1/teacher-assist-v2/instructional/pacing-guides/periods/${periodId}`, "PUT", body);
}

export function fetchV2PacingGuideSupportingMaterials(
  pacingGuideId: string,
  filters?: {
    period_id?: string;
    period_day_id?: string;
    education_objective_id?: string;
    guide_level_only?: boolean;
    week_level_only?: boolean;
  },
) {
  const params = new URLSearchParams();
  if (filters?.period_id) params.set("period_id", filters.period_id);
  if (filters?.period_day_id) params.set("period_day_id", filters.period_day_id);
  if (filters?.education_objective_id) params.set("education_objective_id", filters.education_objective_id);
  if (filters?.guide_level_only) params.set("guide_level_only", "true");
  if (filters?.week_level_only) params.set("week_level_only", "true");
  const query = params.toString();
  return readJson<PacingGuideSupportingMaterial[]>(
    `/v1/teacher-assist-v2/instructional/pacing-guides/${pacingGuideId}/supporting-materials${query ? `?${query}` : ""}`,
  );
}

export async function uploadV2PacingGuideSupportingFile(
  pacingGuideId: string,
  file: File,
  body: {
    title?: string;
    description?: string;
    resource_type: string;
    period_id?: string;
    period_day_id?: string;
    education_objective_id?: string;
  },
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("resource_type", body.resource_type);
  if (body.title) formData.append("title", body.title);
  if (body.description) formData.append("description", body.description);
  if (body.period_id) formData.append("period_id", body.period_id);
  if (body.period_day_id) formData.append("period_day_id", body.period_day_id);
  if (body.education_objective_id) formData.append("education_objective_id", body.education_objective_id);

  const response = await authFetch(
    `/v1/teacher-assist-v2/instructional/pacing-guides/${pacingGuideId}/supporting-materials/upload`,
    { method: "POST", body: formData },
  );
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    try {
      const payload = await response.json();
      parseApiFailure(response, payload);
    } catch (error) {
      if (error instanceof ApiFieldErrors || error instanceof Error) throw error;
      throw new Error(`Request failed (${response.status})`);
    }
  }
  return (await response.json()) as PacingGuideSupportingMaterial;
}

export function createV2PacingGuideSupportingLink(
  pacingGuideId: string,
  body: {
    title: string;
    external_url: string;
    resource_type: string;
    description?: string | null;
    period_id?: string;
    period_day_id?: string;
    education_objective_id?: string;
  },
) {
  return writeJson<PacingGuideSupportingMaterial>(
    `/v1/teacher-assist-v2/instructional/pacing-guides/${pacingGuideId}/supporting-materials/links`,
    "POST",
    body,
  );
}

export function createV2PacingGuideSupportingNote(
  pacingGuideId: string,
  body: {
    note_body: string;
    title?: string | null;
    period_id?: string;
    period_day_id?: string;
    education_objective_id?: string;
  },
) {
  return writeJson<PacingGuideSupportingMaterial>(
    `/v1/teacher-assist-v2/instructional/pacing-guides/${pacingGuideId}/supporting-materials/notes`,
    "POST",
    body,
  );
}

export function archiveV2PacingGuideSupportingMaterial(materialId: string) {
  return writeJson<PacingGuideSupportingMaterial>(
    `/v1/teacher-assist-v2/instructional/pacing-guides/supporting-materials/${materialId}/archive`,
    "POST",
  );
}

export function fetchV2PacingGuidePlanningContext(pacingGuideId: string, periodId: string) {
  return readJson<Record<string, unknown>>(
    `/v1/teacher-assist-v2/instructional/pacing-guides/${pacingGuideId}/planning-context?period_id=${encodeURIComponent(periodId)}`,
  );
}

export function fetchV2TeacherOnboardingForm(gradeId?: string) {
  const query = gradeId ? `?grade_id=${encodeURIComponent(gradeId)}` : "";
  return readJson<TeacherOnboardingForm>(`/v1/teacher-assist-v2/teacher/onboarding${query}`);
}

export function saveV2TeacherOnboarding(body: {
  school_year_id: string;
  grade_id: string;
  student_count: number;
  selected_subject_ids: string[];
}) {
  return writeJson<{ landing_route: string }>("/v1/teacher-assist-v2/teacher/onboarding", "POST", body);
}

export function fetchV2PacingGuideSetupForm() {
  return readJson<PacingGuideSetupForm>("/v1/teacher-assist-v2/teacher/pacing-guide-setup");
}

export function saveV2PacingGuideSetup(body: {
  selections: Array<{ subject_id: string; source_guide_id: string; mode: "district" | "teacher_copy" }>;
}) {
  return writeJson<{ landing_route: string }>("/v1/teacher-assist-v2/teacher/pacing-guide-setup", "POST", body);
}

export function fetchV2Gradebook(filters?: {
  school_year_id?: string;
  subject_id?: string;
  assignment_id?: string;
  objective_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.school_year_id) params.set("school_year_id", filters.school_year_id);
  if (filters?.subject_id) params.set("subject_id", filters.subject_id);
  if (filters?.assignment_id) params.set("assignment_id", filters.assignment_id);
  if (filters?.objective_id) params.set("objective_id", filters.objective_id);
  const query = params.toString();
  return readJson<GradebookRecord[]>(`/v1/teacher-assist-v2/teacher/gradebook${query ? `?${query}` : ""}`);
}

export function fetchV2GradebookGridForm() {
  return readJson<GradebookGridForm>("/v1/teacher-assist-v2/teacher/gradebook/grid/form");
}

export function fetchV2GradebookGrid(subjectId: string, gradingPeriodId?: string | null) {
  const params = new URLSearchParams({ subject_id: subjectId });
  if (gradingPeriodId) params.set("grading_period_id", gradingPeriodId);
  return readJson<GradebookGrid>(`/v1/teacher-assist-v2/teacher/gradebook/grid?${params.toString()}`);
}

export function getV2GradebookGridExportUrl(subjectId: string, gradingPeriodId?: string | null) {
  const params = new URLSearchParams({ subject_id: subjectId });
  if (gradingPeriodId) params.set("grading_period_id", gradingPeriodId);
  return `/v1/teacher-assist-v2/teacher/gradebook/grid/export?${params.toString()}`;
}

export function createV2GradebookGridAssignment(body: {
  title: string;
  description?: string | null;
  week_number: number;
  subject_id: string;
  education_objective_ids: string[];
}) {
  return writeJson<AssignmentDetail>("/v1/teacher-assist-v2/teacher/gradebook/grid/assignments", "POST", body);
}

export function saveV2GradebookGridCell(body: {
  assignment_id: string;
  student_number: number;
  score: number;
  max_score?: number;
  teacher_comment?: string;
}) {
  return writeJson<AssignmentGrade>("/v1/teacher-assist-v2/teacher/gradebook/grid/grades", "POST", body);
}

export async function downloadV2GradebookGridCsv(subjectId: string, gradingPeriodId?: string | null) {
  const response = await authFetch(buildApiUrl(getV2GradebookGridExportUrl(subjectId, gradingPeriodId)));
  if (!response) {
    throw new Error("Unable to export gradebook right now.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "gradebook.csv";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fetchV2Mastery(filters?: {
  objective_id?: string;
  student_number?: number;
  assignment_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.objective_id) params.set("objective_id", filters.objective_id);
  if (filters?.student_number !== undefined) params.set("student_number", String(filters.student_number));
  if (filters?.assignment_id) params.set("assignment_id", filters.assignment_id);
  const query = params.toString();
  return readJson<MasteryEvidenceRow[]>(`/v1/teacher-assist-v2/teacher/mastery${query ? `?${query}` : ""}`);
}

export function fetchV2TeacherHome() {
  return readJson<TeacherHomeSummary>("/v1/teacher-assist-v2/teacher/home");
}

export function fetchV2PlanningForm() {
  return readJson<PlanningForm>("/v1/teacher-assist-v2/teacher/planning/form");
}

export function fetchV2PlanningReview(weekStart: number, weekEnd: number) {
  return readJson<PlanningReview>(
    `/v1/teacher-assist-v2/teacher/planning/review?week_start=${weekStart}&week_end=${weekEnd}`,
  );
}

export async function uploadV2PlanningSupplementalFile(
  file: File,
  body: { week_start: number; week_end: number; title?: string; resource_type?: string },
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("week_start", String(body.week_start));
  formData.append("week_end", String(body.week_end));
  formData.append("resource_type", body.resource_type ?? "other");
  if (body.title) formData.append("title", body.title);

  const response = await authFetch("/v1/teacher-assist-v2/teacher/planning/supplemental-materials/upload", {
    method: "POST",
    body: formData,
  });
  if (!response) throw new Error("Could not reach API. Check that the backend is running.");
  if (!response.ok) {
    const payload = await response.json();
    parseApiFailure(response, payload);
  }
  return (await response.json()) as PlanningSupplementalMaterial;
}

export function createV2PlanningSupplementalLink(body: {
  week_start: number;
  week_end: number;
  title: string;
  external_url: string;
  resource_type?: string;
  description?: string | null;
}) {
  return writeJson<PlanningSupplementalMaterial>(
    "/v1/teacher-assist-v2/teacher/planning/supplemental-materials/links",
    "POST",
    body,
  );
}

export function createV2PlanningSupplementalNote(body: {
  week_start: number;
  week_end: number;
  note_body: string;
  title?: string | null;
}) {
  return writeJson<PlanningSupplementalMaterial>(
    "/v1/teacher-assist-v2/teacher/planning/supplemental-materials/notes",
    "POST",
    body,
  );
}

export function extractV2PlanningSupplementalFile(materialId: string) {
  return writeJson<PlanningSupplementalMaterial>(
    `/v1/teacher-assist-v2/teacher/planning/supplemental-materials/${materialId}/extract`,
    "POST",
  );
}

export function generateV2InstructionalPackage(body: {
  week_start: number;
  week_end: number;
  teaching_order: string[];
  selected_outputs: string[];
  plan_start_date?: string;
  plan_end_date?: string;
  excluded_pacing_material_ids?: string[];
}) {
  return writeJson<InstructionalPackageDetail>("/v1/teacher-assist-v2/teacher/planning/packages/generate", "POST", body);
}

export function updateV2PackageRubric(
  packageId: string,
  artifactId: string,
  body: {
    title: string;
    summary?: string | null;
    description?: string | null;
    criteria: PackageRubricCriterion[];
  },
) {
  return writeJson<InstructionalPackageDetail>(
    `/v1/teacher-assist-v2/teacher/planning/packages/${packageId}/artifacts/${artifactId}/rubric`,
    "PUT",
    body,
  );
}

export function fetchV2PackageAdditionalAssignmentForm(packageId: string) {
  return readJson<PackageAdditionalAssignmentForm>(
    `/v1/teacher-assist-v2/teacher/planning/packages/${packageId}/additional-assignments/form`,
  );
}

export function generateV2PackageAdditionalAssignment(
  packageId: string,
  body: {
    subject_id: string;
    artifact_type: string;
    teacher_notes: string;
    title_hint?: string;
  },
) {
  return writeJson<InstructionalPackageDetail>(
    `/v1/teacher-assist-v2/teacher/planning/packages/${packageId}/additional-assignments/generate`,
    "POST",
    body,
  );
}

export function fetchV2InstructionalPackages(filters?: {
  status?: string;
  school_year_id?: string;
  subject_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.school_year_id) params.set("school_year_id", filters.school_year_id);
  if (filters?.subject_id) params.set("subject_id", filters.subject_id);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  const query = params.toString();
  return readJson<InstructionalPackageSummary[]>(
    `/v1/teacher-assist-v2/teacher/packages${query ? `?${query}` : ""}`,
  );
}

export function closeOutV2InstructionalPackage(
  packageId: string,
  body: { close_out_notes?: string | null; completed_date?: string | null },
) {
  return writeJson<InstructionalPackageDetail>(
    `/v1/teacher-assist-v2/teacher/planning/packages/${packageId}/close-out`,
    "POST",
    body,
  );
}

export function fetchV2InstructionalPackage(packageId: string) {
  return readJson<InstructionalPackageDetail>(`/v1/teacher-assist-v2/teacher/planning/packages/${packageId}`);
}

/** Safe variant for background polling — never clears the session on 401. */
export async function pollV2PackageStatus(packageId: string): Promise<string | null> {
  const res = await authFetch(
    `/v1/teacher-assist-v2/teacher/planning/packages/${packageId}`,
    {},
    { clearSessionOn401: false },
  );
  if (!res || !res.ok) return null;
  const data = (await res.json()) as InstructionalPackageDetail;
  return data.status ?? null;
}

export function triggerArtifactImageFetch(artifactId: string) {
  return writeJson<{ fetched: number; pending: number; failed: number; total: number; message: string }>(
    `/v1/teacher-assist-v2/teacher/artifacts/${artifactId}/fetch-images`,
    "POST",
  );
}

export function fetchV2AdminGoogleSettings() {
  return readJson<AdminGoogleSettings>("/v1/teacher-assist-v2/admin/google-settings");
}

export function fetchV2TeacherGoogleConnection() {
  return readJson<GoogleFormsConnectionStatus>("/v1/teacher-assist-v2/teacher/google/connection");
}

export function startV2TeacherGoogleOAuth() {
  return readJson<{ authorization_url: string; state: string }>(
    "/v1/teacher-assist-v2/teacher/google/oauth/start",
  );
}

export async function disconnectV2TeacherGoogle() {
  const response = await authFetch("/v1/teacher-assist-v2/teacher/google/connection", { method: "DELETE" });
  if (!response?.ok) {
    throw new Error(`Disconnect failed (${response?.status ?? "unknown"})`);
  }
}

export function createV2AssignmentGoogleForm(assignmentId: string) {
  return writeJson<{ google_form: AssignmentGoogleForm; message: string }>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/google-form/create`,
    "POST",
  );
}

export function importV2AssignmentGoogleFormResults(assignmentId: string) {
  return writeJson<{ imported_count: number; skipped: unknown[]; message: string }>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/google-form/import-results`,
    "POST",
  );
}

export async function importV2AssignmentGoogleFormCsv(assignmentId: string, file: File) {
  let accessToken = getStoredAccessToken();
  if (!accessToken) {
    const refreshed = await refreshTokens();
    accessToken = refreshed ? getStoredAccessToken() : null;
  }
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    buildApiUrl(`/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/google-form/import-csv`),
    {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: formData,
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed (${response.status})`);
  }
  return (await response.json()) as {
    imported_count: number;
    row_errors: Array<{ line: number; error: string }>;
    message: string;
  };
}

export function fetchV2Assignments(filters?: { status?: string; assignment_type?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.assignment_type) params.set("assignment_type", filters.assignment_type);
  const query = params.toString();
  return readJson<AssignmentSummary[]>(`/v1/teacher-assist-v2/teacher/assignments${query ? `?${query}` : ""}`);
}

export function fetchV2Assignment(assignmentId: string) {
  return readJson<AssignmentDetail>(`/v1/teacher-assist-v2/teacher/assignments/${assignmentId}`);
}

/** Safe variant for background polling — never clears the session on 401. */
export async function pollV2AssignmentGradingCount(assignmentId: string): Promise<number | null> {
  const res = await authFetch(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}`,
    {},
    { clearSessionOn401: false },
  );
  if (!res || !res.ok) return null;
  const data = (await res.json()) as AssignmentDetail;
  return data.grading_activity?.processing_count ?? 0;
}

export function fetchV2ManualAssignmentForm() {
  return readJson<ManualAssignmentForm>("/v1/teacher-assist-v2/teacher/assignments/manual/form");
}

export function fetchV2ManualAssignmentObjectives(weekNumber: number, subjectId: string) {
  return readJson<ManualAssignmentObjective[]>(
    `/v1/teacher-assist-v2/teacher/assignments/manual/objectives?week_number=${weekNumber}&subject_id=${encodeURIComponent(subjectId)}`,
  );
}

export function createV2ManualAssignment(body: {
  title: string;
  description?: string | null;
  week_number: number;
  subject_id: string;
  education_objective_ids: string[];
  assignment_type?: string;
  generate_cover_sheets?: boolean;
}) {
  return writeJson<AssignmentDetail>("/v1/teacher-assist-v2/teacher/assignments/manual", "POST", body);
}

export function generateV2AssignmentCoverSheets(assignmentId: string) {
  return writeJson<AssignmentDetail["cover_sheet"]>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/cover-sheets/generate`,
    "POST",
  );
}

export function fetchV2AssignmentSubmissions(assignmentId: string) {
  return readJson<StudentSubmissionSummary[]>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/submissions`,
  );
}

export function fetchV2AssignmentSubmissionBatches(assignmentId: string) {
  return readJson<SubmissionBatch[]>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/submission-batches`,
  );
}

export function fetchV2StudentSubmission(submissionId: string) {
  return readJson<StudentSubmissionDetail>(`/v1/teacher-assist-v2/teacher/submissions/${submissionId}`);
}

export function extractV2StudentSubmission(submissionId: string) {
  return writeJson<StudentSubmissionDetail>(`/v1/teacher-assist-v2/teacher/submissions/${submissionId}/extract`, "POST");
}

export async function uploadV2AssignmentSubmissionBatch(
  assignmentId: string,
  file: File,
  body?: { student_number?: number },
  onProgress?: (progress: number) => void,
): Promise<SubmissionBatch & { submissions: StudentSubmissionSummary[] }> {
  void onProgress;
  const formData = new FormData();
  formData.append("file", file);
  if (body?.student_number != null) {
    formData.append("student_number", String(body.student_number));
  }
  const response = await authFetch(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/submission-batches`,
    {
      method: "POST",
      body: formData,
    },
  );
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as SubmissionBatch & { submissions: StudentSubmissionSummary[] };
}

export function manualMatchV2StudentSubmission(submissionId: string, studentNumber: number) {
  return writeJson<StudentSubmissionDetail>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/manual-match`,
    "POST",
    { student_number: studentNumber },
  );
}

export function updateV2StudentSubmissionStatus(submissionId: string, status: string) {
  return writeJson<StudentSubmissionDetail>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/status`,
    "PATCH",
    { status },
  );
}

export function saveV2StudentSubmissionResponseText(submissionId: string, responseText: string) {
  return writeJson<StudentSubmissionDetail>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/response-text`,
    "PUT",
    { response_text: responseText },
  );
}

export function fetchV2AssignmentReviewQueue(assignmentId: string) {
  return readJson<StudentSubmissionSummary[]>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/review-queue`,
  );
}

export function markV2SubmissionIncomplete(submissionId: string) {
  return writeJson<StudentSubmissionDetail>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/incomplete`,
    "POST",
  );
}

export async function uploadV2SubmissionSupplement(submissionId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await authFetch(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/supplement-upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as StudentSubmissionDetail;
}

export function generateV2SubmissionGradingDraft(submissionId: string) {
  return writeJson<GradingJob>(`/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grading-jobs`, "POST");
}

export function generateV2AssignmentGradingDrafts(assignmentId: string) {
  return writeJson<{
    generated_count: number;
    failed_count: number;
    jobs: GradingJob[];
    errors: Array<{ student_submission_id: string; student_number: string; error: string }>;
  }>(`/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/grading-jobs/generate-all`, "POST");
}

export function fetchV2SubmissionGradingDraft(submissionId: string) {
  return readJson<GradingDraft>(`/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grading-draft`);
}

export function fetchV2AssignmentGradeReviews(assignmentId: string) {
  return readJson<GradeReviewRow[]>(`/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/grade-reviews`);
}

export function fetchV2SubmissionGradeAuditHistory(submissionId: string) {
  return readJson<GradeAuditEvent[]>(`/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grade-audit-history`);
}

export function acceptV2SubmissionGrade(
  submissionId: string,
  body?: {
    score?: number;
    max_score?: number;
    teacher_comment?: string;
    rubric_json?: GradingDraft["rubric_json"];
    student_facing_feedback?: StudentFacingFeedback | null;
  },
) {
  return writeJson<AssignmentGrade>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grade-review/accept`,
    "POST",
    body ?? {},
  );
}

export async function fetchV2SubmissionRubricScorecardHtml(submissionId: string) {
  const response = await authFetch(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/rubric-scorecard`,
  );
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return response.text();
}

export async function downloadV2AssignmentRubricScoreReportDocx(assignmentId: string) {
  const response = await authFetch(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/rubric-score-report`,
  );
  if (!response) {
    throw new Error("Could not reach API. Check that the backend is running.");
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "rubric-score-report.docx";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openPrintableHtml(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}

export function modifyV2SubmissionGrade(
  submissionId: string,
  body: {
    score: number;
    max_score: number;
    teacher_comment: string;
    rubric_json: GradingDraft["rubric_json"];
    teacher_override_reason: string;
    student_facing_feedback?: StudentFacingFeedback | null;
  },
) {
  return writeJson<AssignmentGrade>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grade-review/modify`,
    "POST",
    body,
  );
}

export function fetchV2AssignmentClassInsight(assignmentId: string) {
  return readJson<ClassInsight>(`/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/class-insight`);
}

// ── Recovery Queue ──────────────────────────────────────────────────────────

export function createV2RecoveryQueueItem(body: {
  recommendation_type: string;
  reason: string;
  students_affected: number[];
  assignment_id?: string | null;
  instructional_package_id?: string | null;
  education_objective_id?: string | null;
  misconception_text?: string | null;
  evidence_snapshot?: Record<string, unknown> | null;
  mastery_snapshot?: Record<string, unknown> | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}) {
  return writeJson<RecoveryQueueItem>(`/v1/teacher-assist-v2/teacher/recovery-queue`, "POST", body);
}

export function fetchV2RecoveryQueue(params?: {
  assignment_id?: string;
  instructional_package_id?: string;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (params?.assignment_id) query.set("assignment_id", params.assignment_id);
  if (params?.instructional_package_id) query.set("instructional_package_id", params.instructional_package_id);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return readJson<RecoveryQueueItem[]>(`/v1/teacher-assist-v2/teacher/recovery-queue${qs ? `?${qs}` : ""}`);
}

export function updateV2RecoveryQueueItem(
  itemId: string,
  body: {
    teacher_response?: string | null;
    teacher_notes?: string | null;
    scheduled_for?: string | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
    status?: string | null;
    post_recovery_mastery_snapshot?: Record<string, unknown> | null;
  },
) {
  return writeJson<RecoveryQueueItem>(
    `/v1/teacher-assist-v2/teacher/recovery-queue/${itemId}`,
    "PATCH",
    body,
  );
}

export function fetchV2RecoveryBudget(packageId: string) {
  return readJson<RecoveryBudget>(`/v1/teacher-assist-v2/teacher/packages/${packageId}/recovery-budget`);
}

// ── Phase 8: Learning Recovery Planner ────────────────────────────────────────

export function fetchV2RecoveryDecision(assignmentId: string) {
  return readJson<RecoveryDecision>(
    `/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/recovery-decision`,
  );
}

export function generateV2RecoveryArtifact(itemId: string, artifactType: string) {
  return writeJson<RecoveryArtifact>(
    `/v1/teacher-assist-v2/teacher/recovery-queue/${itemId}/artifacts`,
    "POST",
    { artifact_type: artifactType },
  );
}

export function fetchV2RecoveryArtifacts(itemId: string) {
  return readJson<RecoveryArtifact[]>(
    `/v1/teacher-assist-v2/teacher/recovery-queue/${itemId}/artifacts`,
  );
}

// ── Phase 9: Teacher Workspace — Today ────────────────────────────────────────

export function fetchV2TodayClassroom() {
  return readJson<TodayClassroom>("/v1/teacher-assist-v2/teacher/today");
}

export function rejectV2SubmissionGrade(
  submissionId: string,
  body: {
    score: number;
    max_score: number;
    teacher_comment: string;
    rubric_json: GradingDraft["rubric_json"];
    teacher_override_reason?: string | null;
  },
) {
  return writeJson<AssignmentGrade>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grade-review/reject`,
    "POST",
    body,
  );
}

export function saveV2SubmissionGradeReview(
  submissionId: string,
  body: {
    score: number;
    max_score: number;
    teacher_comment: string;
    rubric_json: GradingDraft["rubric_json"];
    teacher_override_reason?: string | null;
  },
) {
  return writeJson<AssignmentGrade>(
    `/v1/teacher-assist-v2/teacher/submissions/${submissionId}/grade-review/save`,
    "POST",
    body,
  );
}

export function acceptAllViewedV2SubmissionGrades(assignmentId: string) {
  return writeJson<{
    accepted_count: number;
    skipped_count: number;
    grades: AssignmentGrade[];
    skipped: Array<{ student_submission_id: string; reason: string }>;
  }>(`/v1/teacher-assist-v2/teacher/assignments/${assignmentId}/grade-review/accept-all-viewed`, "POST");
}

export function fetchV2AdminTeachers() {
  return readJson<AdminTeacherRow[]>("/v1/teacher-assist-v2/admin/teachers");
}

export function provisionV2Teacher(body: {
  email?: string;
  full_name?: string;
  user_id?: string;
  state_id: string;
  district_id: string;
  school_id: string;
  catalog_grade_id?: string;
  tenant_name?: string;
}) {
  return writeJson<TeacherProvisionResult>("/v1/teacher-assist-v2/admin/teachers/provision", "POST", body);
}
