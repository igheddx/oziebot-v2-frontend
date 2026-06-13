import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res || !res.ok) {
    throw new Error(res ? await parseErrorMessage(res) : "Could not reach API");
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
