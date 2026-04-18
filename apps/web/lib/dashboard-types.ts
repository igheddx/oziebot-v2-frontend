export type TradingMode = "paper" | "live";

export type DashboardSummary = {
  availableBalance: number;
  portfolioValue: number;
  pnlValue: number;
  pnlPercent: number;
  gainLossLabel: string;
  growth: number[];
  enabledStrategies: Array<{ id: string; name: string; enabled: boolean; allocationPct: number }>;
  positions: Array<{
    id: string;
    symbol: string;
    strategy: string;
    side: "long" | "short";
    quantity: string;
    markPrice: number;
    unrealizedPnl: number;
    exposure: number;
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
};

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
