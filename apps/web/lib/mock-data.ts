import type {
  AlertConfig,
  AllocationItem,
  BillingSummary,
  CoinbaseConnection,
  DashboardSummary,
  TokenItem,
  TradingMode,
} from "@/lib/dashboard-types";

const baseGrowthPaper = [100, 101, 102, 102.4, 103.3, 104.1, 104.8, 105.4, 106.2, 106.8, 107.1, 107.9];
const baseGrowthLive = [100, 99.2, 100.3, 101.8, 100.9, 102.1, 102.7, 101.9, 103.4, 104.6, 103.8, 105.2];

export function mockDashboard(mode: TradingMode): DashboardSummary {
  const isLive = mode === "live";
  return {
    availableBalance: isLive ? 18214.64 : 6240.31,
    portfolioValue: isLive ? 52743.12 : 18290.44,
    pnlValue: isLive ? 1248.11 : 612.09,
    pnlPercent: isLive ? 2.42 : 3.46,
    gainLossLabel: isLive ? "Today" : "Session",
    growth: isLive ? baseGrowthLive : baseGrowthPaper,
    enabledStrategies: [
      { id: "momentum", name: "Momentum", enabled: true, allocationPct: 42 },
      { id: "dca", name: "DCA", enabled: true, allocationPct: 28 },
      { id: "day-trading", name: "Day Trading", enabled: !isLive, allocationPct: 12 },
      { id: "mean-reversion", name: "Mean Reversion", enabled: isLive, allocationPct: 18 },
    ],
    positions: [
      {
        id: "pos-btc",
        symbol: "BTC-USD",
        strategy: "Momentum",
        side: "long",
        quantity: "0.44",
        markPrice: isLive ? 68722 : 68400,
        unrealizedPnl: isLive ? 392 : 281,
        exposure: isLive ? 30237 : 30096,
      },
      {
        id: "pos-sol",
        symbol: "SOL-USD",
        strategy: "DCA",
        side: "long",
        quantity: "85",
        markPrice: isLive ? 169.1 : 171.2,
        unrealizedPnl: isLive ? -54 : 62,
        exposure: isLive ? 14374 : 14552,
      },
    ],
    activeTrades: [
      {
        id: "trade-1",
        symbol: "ETH-USD",
        strategy: "Momentum",
        status: "partially_filled",
        progressPct: 64,
        submittedAt: "2m ago",
        notional: 4800,
      },
      {
        id: "trade-2",
        symbol: "ADA-USD",
        strategy: "DCA",
        status: "pending",
        progressPct: 22,
        submittedAt: "4m ago",
        notional: 910,
      },
    ],
    recentActivity: [
      {
        id: "activity-1",
        symbol: "BTC-USD",
        side: "buy",
        status: "filled",
        amount: "0.08",
        price: 68310,
        timestamp: "11:22",
      },
      {
        id: "activity-2",
        symbol: "DOGE-USD",
        side: "sell",
        status: "cancelled",
        amount: "4200",
        price: 0.17,
        timestamp: "10:58",
      },
      {
        id: "activity-3",
        symbol: "ETH-USD",
        side: "buy",
        status: "filled",
        amount: "0.63",
        price: 3514,
        timestamp: "09:44",
      },
    ],
  };
}

export function mockTokens(mode: TradingMode): TokenItem[] {
  const liveOnlyDisabled = mode === "live" ? ["DOGE", "SHIB"] : [];
  return [
    { id: "btc", symbol: "BTC", quote: "USD", name: "Bitcoin", enabled: true, volatility: "medium" },
    { id: "eth", symbol: "ETH", quote: "USD", name: "Ethereum", enabled: true, volatility: "medium" },
    {
      id: "sol",
      symbol: "SOL",
      quote: "USD",
      name: "Solana",
      enabled: true,
      volatility: "high",
    },
    {
      id: "doge",
      symbol: "DOGE",
      quote: "USD",
      name: "Dogecoin",
      enabled: !liveOnlyDisabled.includes("DOGE"),
      volatility: "high",
    },
  ];
}

export function mockAllocation(): AllocationItem[] {
  return [
    { strategyId: "momentum", strategyName: "Momentum", percent: 42, availableCash: 7400 },
    { strategyId: "dca", strategyName: "DCA", percent: 28, availableCash: 4500 },
    { strategyId: "mean-reversion", strategyName: "Mean Reversion", percent: 18, availableCash: 3200 },
    { strategyId: "day-trading", strategyName: "Day Trading", percent: 12, availableCash: 1900 },
  ];
}

export function mockAlerts(): AlertConfig {
  return {
    push: true,
    email: false,
    tradeFilled: true,
    drawdown: true,
    orderFailed: true,
  };
}

export function mockBillingSummary(): BillingSummary {
  return {
    trialStartedAt: null,
    trialEndsAt: null,
    trialActive: false,
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_ozie_demo",
    currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 22).toISOString(),
  };
}

export function mockCoinbaseConnection(): CoinbaseConnection {
  return {
    id: "conn-demo",
    provider: "coinbase",
    apiKeyNameMasked: "orga...89ab",
    validationStatus: "valid",
    healthStatus: "healthy",
    lastValidatedAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    lastError: null,
    canTrade: true,
    canReadBalances: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
