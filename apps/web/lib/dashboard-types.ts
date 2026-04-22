export type TradingMode = "paper" | "live";

export type DashboardOverview = {
  availableBalance: number;
  portfolioValue: number;
  pnlValue: number;
  pnlPercent: number;
  gainLossLabel: string;
  growth: number[];
  positionsCount: number;
  activeTradesCount: number;
  recentActivityCount: number;
  totalFeesMonth: number;
  avgNetEdgeAtEntryBps: number;
  totalRejected: number;
};

export type DashboardDetails = {
  enabledStrategies: Array<{ id: string; name: string; enabled: boolean; allocationPct: number }>;
  positions: Array<{
    id: string;
    symbol: string;
    strategy: string;
    side: "long" | "short";
    quantity: string;
    entryPrice: number;
    markPrice: number;
    unrealizedPnl: number;
    exposure: number;
    openedAt: string | null;
    lastTradeAt: string | null;
    closedAt: string | null;
    ageMinutes: number | null;
    ageHours: number | null;
  }>;
  activeTrades: Array<{
    id: string;
    symbol: string;
    strategy: string;
    status: "pending" | "partially_filled" | "open";
    progressPct: number;
    submittedAt: string;
    notional: number;
  }>;
  recentActivity: Array<{
    id: string;
    symbol: string;
    side: "buy" | "sell";
    status: "filled" | "cancelled" | "failed";
    amount: string;
    price: number;
    timestamp: string;
  }>;
  feeAnalytics: {
    grossPnl: number;
    netPnl: number;
    totalFeesToday: number;
    totalFeesWeek: number;
    totalFeesMonth: number;
    feesByStrategy: Array<{ strategy: string; fees: number }>;
    feesBySymbol: Array<{ symbol: string; fees: number }>;
    makerCount: number;
    takerCount: number;
    mixedCount: number;
    avgEstimatedSlippageBps: number;
    avgNetEdgeAtEntryBps: number;
    skippedTradesDueToFees: number;
    paperLiveComparison: Record<TradingMode, { fees: number; netPnl: number }>;
  };
  rejectionDiagnostics: {
    totalRejected: number;
    byStage: Array<{ stage: string; count: number }>;
    breakdown: Array<{
      stage: string;
      reasonCode: string;
      count: number;
      lastSeenAt: string | null;
      latestDetail: string | null;
      strategies: string[];
      symbols: string[];
    }>;
    recent: Array<{
      stage: string;
      reasonCode: string;
      reasonDetail: string | null;
      strategy: string | null;
      symbol: string | null;
      createdAt: string | null;
    }>;
  };
};

export type DashboardRejections = {
  windowHours: 1 | 3 | 6 | 24 | 48;
  skippedTradesDueToFees: number;
  rejectionDiagnostics: {
    totalRejected: number;
    byStage: Array<{ stage: string; count: number }>;
    breakdown: Array<{
      stage: string;
      reasonCode: string;
      count: number;
      lastSeenAt: string | null;
      latestDetail: string | null;
      strategies: string[];
      symbols: string[];
    }>;
    recent: Array<{
      stage: string;
      reasonCode: string;
      reasonDetail: string | null;
      strategy: string | null;
      symbol: string | null;
      createdAt: string | null;
    }>;
  };
  budget: {
    windowHours: number;
    eventLimit: number;
    startAt: string;
    endAt: string;
    capped: boolean;
  };
};

export type DashboardSummary = DashboardOverview & DashboardDetails;

export type TokenItem = {
  id: string;
  symbol: string;
  quote: string;
  name: string;
  enabled: boolean;
  volatility: "low" | "medium" | "high";
};

export type AlertConfig = {
  push: boolean;
  email: boolean;
  tradeFilled: boolean;
  drawdown: boolean;
  orderFailed: boolean;
};

export type AllocationItem = {
  strategyId: string;
  strategyName: string;
  percent: number;
  availableCash: number;
};

export type BillingSummary = {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialActive: boolean;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
};

export type CoinbaseConnection = {
  id: string;
  provider: string;
  apiKeyNameMasked: string;
  validationStatus: string;
  healthStatus: string | null;
  lastValidatedAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  canTrade: boolean | null;
  canReadBalances: boolean | null;
  createdAt: string;
  updatedAt: string;
};
