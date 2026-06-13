import { authFetch, parseErrorMessage } from "@/lib/auth-service";

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

export function fetchInstructionalWeeks(params?: Record<string, string>) {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return readJson<Record<string, unknown>[]>(`/v1/teacher-assist/instructional-weeks${query ? `?${query}` : ""}`);
}

export function fetchInstructionalWeekByPeriod(periodId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/instructional-weeks/by-period/${periodId}`);
}

export function fetchInstructionalWeekWorkspace(weekId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/instructional-weeks/${weekId}/workspace`);
}

export function previewInstructionalWeekFromPeriod(periodId: string) {
  return readJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/instructional-week-preview`);
}

export function createInstructionalWeekFromPeriod(periodId: string, body: Record<string, unknown> = {}) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/pacing-guide-periods/${periodId}/instructional-weeks`, "POST", body);
}

export function generateNextInstructionalWeek(weekId: string) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/instructional-weeks/${weekId}/generate-next-week`, "POST");
}

export function createInstructionalWeekSnapshot(weekId: string, name: string) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/instructional-weeks/${weekId}/snapshots`, "POST", { name });
}

export function updateInstructionalWeek(weekId: string, body: Record<string, unknown>) {
  return writeJson<Record<string, unknown>>(`/v1/teacher-assist/instructional-weeks/${weekId}`, "PATCH", body);
}
