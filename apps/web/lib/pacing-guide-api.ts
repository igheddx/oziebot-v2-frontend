import { authFetch, parseErrorMessage } from "@/lib/auth-service";
import type {
  CatalogPacingGuideDetail,
  CatalogPacingGuideObjective,
  CatalogPacingGuidePeriod,
  CatalogPacingGuideResource,
  CatalogPacingGuideSummary,
  PacingGuideType,
  PacingSchoolYearOptions,
} from "@/lib/pacing-guide-types";

const base = "/v1/teacher-assist/pacing-guides";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function coercePacingGuideId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return UUID_RE.test(trimmed) ? trimmed : undefined;
  }
  if (value && typeof value === "object" && "id" in value) {
    return coercePacingGuideId((value as { id?: unknown }).id);
  }
  return undefined;
}

async function readJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res || !res.ok) {
    throw new Error(res ? await parseErrorMessage(res) : "Could not reach API");
  }
  return (await res.json()) as T;
}

async function writeJson<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await authFetch(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res || !res.ok) {
    throw new Error(res ? await parseErrorMessage(res) : "Could not reach API");
  }
  if (method === "DELETE" && res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function fetchCatalogPacingGuides(params?: {
  guide_type?: PacingGuideType;
  catalog_school_id?: string;
  active_only?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.guide_type) search.set("guide_type", params.guide_type);
  if (params?.catalog_school_id) search.set("catalog_school_id", params.catalog_school_id);
  if (params?.active_only === false) search.set("active_only", "false");
  const query = search.toString();
  return readJson<CatalogPacingGuideSummary[]>(`${base}${query ? `?${query}` : ""}`);
}

export function fetchPacingGuideSchoolYearOptions() {
  return readJson<PacingSchoolYearOptions>(`${base}/school-year-options`);
}

export function fetchCatalogPacingGuideDetail(id: string) {
  return readJson<CatalogPacingGuideDetail>(`${base}/${id}`);
}

export function createCatalogPacingGuide(body: Record<string, unknown>) {
  return writeJson<CatalogPacingGuideDetail>(base, "POST", body);
}

export function updateCatalogPacingGuide(id: string, body: Record<string, unknown>) {
  return writeJson<CatalogPacingGuideDetail>(`${base}/${id}`, "PUT", body);
}

export function deactivateCatalogPacingGuide(id: string) {
  return writeJson<CatalogPacingGuideSummary>(`${base}/${id}`, "DELETE");
}

export function createCatalogPacingGuidePeriod(guideId: string, body: Record<string, unknown>) {
  return writeJson<CatalogPacingGuidePeriod>(`${base}/${guideId}/periods`, "POST", body);
}

export function updateCatalogPacingGuidePeriod(
  guideId: string,
  periodId: string,
  body: Record<string, unknown>,
) {
  return writeJson<CatalogPacingGuidePeriod>(`${base}/${guideId}/periods/${periodId}`, "PUT", body);
}

export function deleteCatalogPacingGuidePeriod(guideId: string, periodId: string) {
  return writeJson<void>(`${base}/${guideId}/periods/${periodId}`, "DELETE");
}

export function addCatalogPacingGuideObjective(
  guideId: string,
  periodId: string,
  body: Record<string, unknown>,
) {
  return writeJson<CatalogPacingGuideObjective>(`${base}/${guideId}/periods/${periodId}/objectives`, "POST", body);
}

export function addCatalogPacingGuideResource(
  guideId: string,
  periodId: string,
  body: Record<string, unknown>,
) {
  return writeJson<CatalogPacingGuideResource>(`${base}/${guideId}/periods/${periodId}/resources`, "POST", body);
}

export function copyCatalogPacingGuide(guideId: string, body: Record<string, unknown>) {
  return writeJson<CatalogPacingGuideDetail>(`${base}/${guideId}/copy`, "POST", body);
}

export function rolloverCatalogPacingGuides(body: Record<string, unknown>) {
  return writeJson<CatalogPacingGuideDetail[]>(`${base}/rollover`, "POST", body);
}

export function fetchCurrentWeek(guideId?: string) {
  const normalized = coercePacingGuideId(guideId);
  const query = normalized ? `?guide_id=${encodeURIComponent(normalized)}` : "";
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/current-week${query}`);
}

export function fetchPacingGuideWorkspace(params?: { guide_id?: string; period_id?: string }) {
  const search = new URLSearchParams();
  const guideId = coercePacingGuideId(params?.guide_id);
  const periodId = coercePacingGuideId(params?.period_id);
  if (guideId) search.set("guide_id", guideId);
  if (periodId) search.set("period_id", periodId);
  const query = search.toString();
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-workspace${query ? `?${query}` : ""}`);
}

export function updateActivePacingGuideSelection(body: {
  active_pacing_guide_id?: string | null;
  manual_pacing_period_id?: string | null;
}) {
  return writeJson<Record<string, unknown>>(`${base}/active-selection`, "PATCH", body);
}

export function fetchPeriodLaunchContext(periodId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/launch-context`);
}

export function updatePacingPeriodNotes(guideId: string, periodId: string, notes: string | null) {
  return writeJson<{ period_id: string; notes: string | null }>(
    `${base}/${guideId}/periods/${periodId}/notes`,
    "PUT",
    { notes },
  );
}

export function fetchWeekWorkspace(periodId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/week-workspace?period_id=${encodeURIComponent(periodId)}`);
}

export function fetchWeekContext(periodId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/week-context`);
}

export function generateWeekArtifact(periodId: string, body: { artifact_type: string; class_id?: string }) {
  return writeJson<Record<string, unknown>>(
    `/v1/teacher-assist/pacing-guide-periods/${periodId}/generate`,
    "POST",
    body,
  );
}

export function duplicateWeekArtifact(periodId: string, artifactId: string) {
  return writeJson<Record<string, unknown>>(
    `/v1/teacher-assist/pacing-guide-periods/${periodId}/artifacts/${artifactId}/duplicate`,
    "POST",
  );
}

export function duplicatePacingWeek(periodId: string, body: Record<string, unknown>) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/duplicate`, "POST", body);
}

export function generateNextWeek(periodId: string) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/generate-next-week`, "POST");
}

export function fetchReuseSearch(periodId: string) {
  return readJson<Record<string, unknown>[]>(`/v1/teacher-assist/reuse/search?period_id=${encodeURIComponent(periodId)}`);
}

export function fetchWeekRecommendations(periodId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/recommendations`);
}

export function fetchWeekTemplates(params?: Record<string, string>) {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return readJson<Record<string, unknown>[]>(`/v1/teacher-assist/week-templates${query ? `?${query}` : ""}`);
}

export function saveWeekTemplate(periodId: string, body: Record<string, unknown>) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/templates`, "POST", body);
}

export function applyWeekTemplate(templateId: string, targetPeriodId: string) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/week-templates/${templateId}/apply`, "POST", {
    target_period_id: targetPeriodId,
  });
}

export function fetchEfficiencyDashboard() {
  return readJson<Record<string, unknown>>("/v1/teacher-assist/efficiency-dashboard");
}
