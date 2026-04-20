import { authFetch } from "@/lib/auth-service";
import type { TradingMode } from "@/lib/dashboard-types";
import type { ReviewAnalyticsPayload } from "@/lib/analytics-types";

type AnalyticsOptions = {
  strategyName?: string;
  symbol?: string;
  rangeDays?: number;
};

function emptyAnalytics(mode: TradingMode): ReviewAnalyticsPayload {
  return {
    filters: {
      tradingMode: mode,
      strategyName: null,
      symbol: null,
      startAt: null,
      endAt: null,
    },
    summary: {
      evaluated: 0,
      emitted: 0,
      reduced: 0,
      rejected: 0,
      executed: 0,
      profitable: 0,
      rejectionRatePct: 0,
      executionRatePct: 0,
      profitabilityRatePct: 0,
      totalRealizedPnl: 0,
      totalFees: 0,
      avgSlippagePct: 0,
      avgHoldMinutes: 0,
      overFilteringFlag: false,
    },
    signalFunnel: [],
    strategyPerformance: [],
    tokenPerformance: [],
    pairPerformance: [],
    rejectionBreakdown: {
      totalRejected: 0,
      byStage: [],
      rows: [],
    },
    paperLiveComparison: {
      overview: [],
      strategies: [],
    },
    availableStrategies: [],
    availableSymbols: [],
  };
}

export async function getTradeReviewAnalytics(
  mode: TradingMode,
  options: AnalyticsOptions = {},
): Promise<ReviewAnalyticsPayload> {
  const params = new URLSearchParams();
  params.set("trading_mode", mode);
  if (options.strategyName) params.set("strategy_name", options.strategyName);
  if (options.symbol) params.set("symbol", options.symbol);
  if (options.rangeDays && options.rangeDays > 0) {
    const startAt = new Date(Date.now() - options.rangeDays * 24 * 60 * 60 * 1000);
    params.set("start_at", startAt.toISOString());
  }

  const res = await authFetch(`/v1/me/analytics?${params.toString()}`);
  if (!res || !res.ok) return emptyAnalytics(mode);
  return (await res.json()) as ReviewAnalyticsPayload;
}
