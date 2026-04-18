import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export type FeeSettings = Record<string, unknown>;

async function readJson<T>(path: string): Promise<{ data?: T; error?: string }> {
  const res = await authFetch(path);
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as T };
}

export async function fetchFeeSettings(): Promise<{ data?: FeeSettings; error?: string }> {
  return readJson<FeeSettings>("/v1/admin/platform/fee-settings");
}

export async function saveFeeSettings(
  value: FeeSettings,
): Promise<{ data?: { key: string; value: FeeSettings; updated_at: string }; error?: string }> {
  const res = await authFetch("/v1/admin/platform/fee-settings", {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as { key: string; value: FeeSettings; updated_at: string } };
}
