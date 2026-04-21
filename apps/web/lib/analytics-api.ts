import { authFetch } from "@/lib/auth-service";
import type { TradingMode } from "@/lib/dashboard-types";
import type {
  AnalyticsRow,
  PaperLiveComparison,
  RejectionBreakdown,
  ReviewAnalyticsPayload,
  ReviewAnalyticsSummaryPayload,
} from "@/lib/analytics-types";

type AnalyticsOptions = {
  strategyName?: string;
  symbol?: string;
  rangeDays?: number;
  forceRefresh?: boolean;
};

function buildAnalyticsParams(mode: TradingMode, options: AnalyticsOptions = {}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("trading_mode", mode);
  if (options.strategyName) params.set("strategy_name", options.strategyName);
  if (options.symbol) params.set("symbol", options.symbol);
  if (options.rangeDays && options.rangeDays > 0) {
    const startAt = new Date(Date.now() - options.rangeDays * 24 * 60 * 60 * 1000);
    params.set("start_at", startAt.toISOString());
  }
  if (options.forceRefresh) params.set("force_refresh", "true");
  return params;
}

async function fetchAnalyticsJson<T>(
  path: string,
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<T | null> {
  const params = buildAnalyticsParams(mode, options);
  const res = await authFetch(`${path}?${params.toString()}`);
  if (!res || !res.ok) return null;
  return (await res.json()) as T;
}

export async function getTradeReviewAnalytics(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<ReviewAnalyticsPayload | null> {
  return fetchAnalyticsJson<ReviewAnalyticsPayload>("/v1/me/analytics", mode, options);
}

export async function getTradeReviewAnalyticsSummary(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<ReviewAnalyticsSummaryPayload | null> {
  return fetchAnalyticsJson<ReviewAnalyticsSummaryPayload>("/v1/me/analytics/summary", mode, options);
}

export async function getTradeReviewStrategyRows(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<AnalyticsRow[] | null> {
  const payload = await fetchAnalyticsJson<{ rows: AnalyticsRow[] }>("/v1/me/analytics/strategies", mode, options);
  return payload?.rows ?? null;
}

export async function getTradeReviewPairRows(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<AnalyticsRow[] | null> {
  const payload = await fetchAnalyticsJson<{ rows: AnalyticsRow[] }>("/v1/me/analytics/pairs", mode, options);
  return payload?.rows ?? null;
}

export async function getTradeReviewRejectionBreakdown(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<RejectionBreakdown | null> {
  const payload = await fetchAnalyticsJson<{ rejectionBreakdown: RejectionBreakdown }>(
    "/v1/me/analytics/rejections",
    mode,
    options,
  );
  return payload?.rejectionBreakdown ?? null;
}

export async function getTradeReviewPaperLiveComparison(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<PaperLiveComparison | null> {
  const payload = await fetchAnalyticsJson<{ paperLiveComparison: PaperLiveComparison }>(
    "/v1/me/analytics/comparison",
    mode,
    options,
  );
  return payload?.paperLiveComparison ?? null;
}
