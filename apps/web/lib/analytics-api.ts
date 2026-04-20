import { authFetch } from "@/lib/auth-service";
import type { TradingMode } from "@/lib/dashboard-types";
import type { ReviewAnalyticsPayload } from "@/lib/analytics-types";

type AnalyticsOptions = {
  strategyName?: string;
  symbol?: string;
  rangeDays?: number;
};

export async function getTradeReviewAnalytics(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<ReviewAnalyticsPayload | null> {
  const params = new URLSearchParams();
  params.set("trading_mode", mode);
  if (options.strategyName) params.set("strategy_name", options.strategyName);
  if (options.symbol) params.set("symbol", options.symbol);
  if (options.rangeDays && options.rangeDays > 0) {
    const startAt = new Date(Date.now() - options.rangeDays * 24 * 60 * 60 * 1000);
    params.set("start_at", startAt.toISOString());
  }

  const res = await authFetch(`/v1/me/analytics?${params.toString()}`);
  if (!res || !res.ok) return null;
  return (await res.json()) as ReviewAnalyticsPayload;
}
