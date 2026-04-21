import type { TradingMode } from "@/lib/dashboard-types";

export type AnalyticsMode = TradingMode | "all";

export type AnalyticsSummary = {
  evaluated: number;
  emitted: number;
  reduced: number;
  rejected: number;
  executed: number;
  profitable: number;
  rejectionRatePct: number;
  executionRatePct: number;
  profitabilityRatePct: number;
  totalRealizedPnl: number;
  totalFees: number;
  avgSlippagePct: number;
  avgHoldMinutes: number;
  overFilteringFlag: boolean;
};

export type AnalyticsRow = {
  strategyName: string | null;
  symbol: string | null;
  tradingMode: TradingMode;
  evaluated: number;
  emitted: number;
  reduced: number;
  rejected: number;
  executed: number;
  profitable: number;
  tradeCount: number;
  winRatePct: number;
  avgWin: number;
  avgLoss: number;
  realizedReturnPct: number;
  totalRealizedPnl: number;
  totalFees: number;
  avgFeePerTrade: number;
  avgSlippagePct: number;
  avgHoldMinutes: number;
  rejectionRatePct: number;
  executionRatePct: number;
  profitabilityRatePct: number;
  executionFailures: number;
  overFilteringFlag: boolean;
  needsReview: boolean;
};

export type RejectionBreakdown = {
  totalRejected: number;
  byStage: Array<{ stage: string; count: number }>;
  rows: Array<{
    stage: string;
    reasonCode: string;
    count: number;
    strategies: string[];
    symbols: string[];
  }>;
};

export type PaperLiveComparison = {
  overview: Array<{
    tradingMode: TradingMode;
    evaluated: number;
    emitted: number;
    reduced: number;
    rejected: number;
    executed: number;
    profitable: number;
    tradeCount: number;
    totalRealizedPnl: number;
    totalFees: number;
    winRatePct: number;
    avgSlippagePct: number;
    avgHoldMinutes: number;
  }>;
  strategies: Array<{
    strategyName: string;
    paper: AnalyticsRow | null;
    live: AnalyticsRow | null;
    deltas: {
      winRatePct: number;
      realizedReturnPct: number;
      totalFees: number;
      avgSlippagePct: number;
    };
  }>;
};

export type ReviewAnalyticsPayload = {
  filters: {
    tradingMode: AnalyticsMode;
    strategyName: string | null;
    symbol: string | null;
    startAt: string | null;
    endAt: string | null;
  };
  summary: AnalyticsSummary;
  signalFunnel: Array<{
    strategyName: string | null;
    tradingMode: TradingMode;
    evaluated: number;
    emitted: number;
    reduced: number;
    rejected: number;
    executed: number;
    profitable: number;
    rejectionRatePct: number;
    executionRatePct: number;
    profitabilityRatePct: number;
    overFilteringFlag: boolean;
  }>;
  strategyPerformance: AnalyticsRow[];
  tokenPerformance: AnalyticsRow[];
  pairPerformance: AnalyticsRow[];
  rejectionBreakdown: RejectionBreakdown;
  paperLiveComparison: PaperLiveComparison;
  availableStrategies: string[];
  availableSymbols: string[];
};

export type ReviewAnalyticsSummaryPayload = Pick<
  ReviewAnalyticsPayload,
  "filters" | "summary" | "availableStrategies" | "availableSymbols"
>;
