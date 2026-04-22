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
    positionsCount: 2,
    activeTradesCount: 2,
    recentActivityCount: 3,
    totalFeesMonth: isLive ? 221.9 : 84.47,
    avgNetEdgeAtEntryBps: isLive ? 46.8 : 61.4,
    totalRejected: isLive ? 14 : 6,
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
        entryPrice: isLive ? 67831 : 67761,
        markPrice: isLive ? 68722 : 68400,
        unrealizedPnl: isLive ? 392 : 281,
        exposure: isLive ? 30237 : 30096,
        openedAt: "2026-04-22T08:15:00Z",
        lastTradeAt: "2026-04-22T10:05:00Z",
        closedAt: null,
        ageMinutes: 240,
        ageHours: 4,
      },
      {
        id: "pos-sol",
        symbol: "SOL-USD",
        strategy: "DCA",
        side: "long",
        quantity: "85",
        entryPrice: isLive ? 169.74 : 170.47,
        markPrice: isLive ? 169.1 : 171.2,
        unrealizedPnl: isLive ? -54 : 62,
        exposure: isLive ? 14374 : 14552,
        openedAt: "2026-04-21T18:40:00Z",
        lastTradeAt: "2026-04-22T07:20:00Z",
        closedAt: null,
        ageMinutes: 1180,
        ageHours: 19.6667,
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
    feeAnalytics: {
      grossPnl: isLive ? 1452.56 : 701.22,
      netPnl: isLive ? 1248.11 : 612.09,
      totalFeesToday: isLive ? 18.42 : 7.11,
      totalFeesWeek: isLive ? 96.33 : 31.28,
      totalFeesMonth: isLive ? 221.9 : 84.47,
      feesByStrategy: [
        { strategy: "momentum", fees: isLive ? 124.5 : 43.2 },
        { strategy: "dca", fees: isLive ? 61.8 : 28.4 },
      ],
      feesBySymbol: [
        { symbol: "BTC-USD", fees: isLive ? 88.2 : 31.7 },
        { symbol: "ETH-USD", fees: isLive ? 56.3 : 22.8 },
      ],
      makerCount: isLive ? 12 : 20,
      takerCount: isLive ? 18 : 9,
      mixedCount: isLive ? 4 : 3,
      avgEstimatedSlippageBps: isLive ? 11.4 : 8.2,
      avgNetEdgeAtEntryBps: isLive ? 46.8 : 61.4,
      skippedTradesDueToFees: isLive ? 7 : 3,
      paperLiveComparison: {
        paper: { fees: 84.47, netPnl: 612.09 },
        live: { fees: 221.9, netPnl: 1248.11 },
      },
    },
    rejectionDiagnostics: {
      totalRejected: isLive ? 12 : 5,
      byStage: [
        { stage: "risk", count: isLive ? 6 : 2 },
        { stage: "suppression", count: isLive ? 4 : 2 },
        { stage: "execution", count: isLive ? 2 : 1 },
      ],
      breakdown: [
        {
          stage: "risk",
          reasonCode: "policy",
          count: isLive ? 4 : 2,
          lastSeenAt: new Date().toISOString(),
          latestDetail: "fee_economics: Expected net edge below threshold",
          strategies: ["momentum", "reversion"],
          symbols: ["BTC-USD", "ETH-USD"],
        },
        {
          stage: "suppression",
          reasonCode: "max_open_positions reached",
          count: isLive ? 3 : 1,
          lastSeenAt: new Date().toISOString(),
          latestDetail: "Strategy suppression blocked new buy",
          strategies: ["day_trading"],
          symbols: ["SOL-USD"],
        },
      ],
      recent: [
        {
          stage: "execution",
          reasonCode: "coinbase_connection",
          reasonDetail: "Coinbase connection is not trade-enabled",
          strategy: "dca",
          symbol: "SOL-USD",
          createdAt: new Date().toISOString(),
        },
        {
          stage: "risk",
          reasonCode: "policy",
          reasonDetail: "fee_economics: Expected net edge below threshold",
          strategy: "momentum",
          symbol: "BTC-USD",
          createdAt: new Date().toISOString(),
        },
      ],
    },
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
