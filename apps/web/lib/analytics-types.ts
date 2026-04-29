import type { TradingMode } from "@/lib/dashboard-types";

export type AnalyticsMode = TradingMode | "all";

export type AnalyticsSummary = {
  evaluated: number;
  emitted: number;
  suppressed: number;
  riskRejected: number;
  executionRejected: number;
  reduced: number;
  rejected: number;
  executed: number;
  tradeCount: number;
  closedProfitable: number;
  closedUnprofitable: number;
  profitable: number;
  rejectionRatePct: number;
  executionRatePct: number;
  profitabilityRatePct: number;
  winRatePct: number;
  avgWin: number;
  avgLoss: number;
  totalRealizedPnl: number;
  totalFees: number;
  avgSlippagePct: number;
  avgHoldMinutes: number;
  avgGivebackPct: number;
  maxDrawdownEstimate: number;
  partialProfitCount: number;
  stopLossCount: number;
  takeProfitCount: number;
  trailingStopCount: number;
  maxAgeExitCount: number;
  overFilteringFlag: boolean;
};

export type AnalyticsRow = {
  strategyName: string | null;
  symbol: string | null;
  tradingMode: TradingMode;
  evaluated: number;
  emitted: number;
  suppressed: number;
  riskRejected: number;
  executionRejected: number;
  reduced: number;
  rejected: number;
  executed: number;
  closedProfitable: number;
  closedUnprofitable: number;
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
  avgGivebackPct: number;
  avgHoldMinutes: number;
  maxDrawdownEstimate: number;
  partialProfitCount: number;
  stopLossCount: number;
  takeProfitCount: number;
  trailingStopCount: number;
  maxAgeExitCount: number;
  rejectionRatePct: number;
  executionRatePct: number;
  profitabilityRatePct: number;
  executionFailures: number;
  overFilteringFlag: boolean;
  needsReview: boolean;
};

export type OutcomeAnalyticsRow = {
  outcomeId: string;
  tradeId: string | null;
  strategyName: string | null;
  symbol: string | null;
  tradingMode: TradingMode;
  timestamp: string;
  holdMinutes: number;
  realizedPnl: number;
  realizedReturnPct: number;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  profitGivebackPct: number;
  partialProfitTaken: boolean;
  remainingPositionOutcome: string | null;
  exitReason: string | null;
  entryPrice: number;
  exitPrice: number;
  filledSize: number;
};

export type PaperLiveValidation = {
  overview: {
    paperTradesReviewed: number;
    wouldPassLiveEquivalent: number;
    wouldRejectLiveEquivalent: number;
    rejectionRatePct: number;
  };
  reasonBreakdown: Array<{ reasonCode: string; count: number }>;
  rows: Array<{
    outcomeId: string;
    strategyName: string | null;
    symbol: string | null;
    signalTimestamp: string | null;
    executedAt: string;
    realizedPnl: number;
    realizedReturnPct: number;
    profitGivebackPct: number;
    liveEquivalentRejected: boolean;
    rejectedReasonCodes: string[];
    signalSpreadPct: number;
    signalEstimatedSlippagePct: number;
  }>;
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
    suppressed: number;
    riskRejected: number;
    executionRejected: number;
    reduced: number;
    rejected: number;
    executed: number;
    closedProfitable: number;
    closedUnprofitable: number;
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
  outcomes: OutcomeAnalyticsRow[];
  paperLiveValidation: PaperLiveValidation;
  availableStrategies: string[];
  availableSymbols: string[];
};

export type ReviewAnalyticsSummaryPayload = Pick<
  ReviewAnalyticsPayload,
  "filters" | "summary" | "availableStrategies" | "availableSymbols"
>;
