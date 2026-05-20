import type { TradingMode } from "@/lib/dashboard-types";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export async function downloadTradingPerformanceCsv(
  mode: TradingMode,
  options: { limit?: number } = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const params = new URLSearchParams();
  params.set("trading_mode", mode);
  if (options.limit != null && options.limit > 0) {
    params.set("limit", String(options.limit));
  }
  const res = await authFetch(`/v1/me/exports/trading-performance.csv?${params.toString()}`, {
    method: "GET",
  });
  if (!res) {
    return { ok: false, message: "Could not reach API" };
  }
  if (!res.ok) {
    return { ok: false, message: await parseErrorMessage(res) };
  }
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition");
  let filename = "oziebot-trade-outcomes.csv";
  const m = dispo?.match(/filename="([^"]+)"/);
  if (m?.[1]) {
    filename = m[1];
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
