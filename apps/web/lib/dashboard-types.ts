export type TradingMode = "paper" | "live";

export type DashboardOverview = {
  availableBalance: number;
  portfolioValue: number;
  pnlValue: number;
  realizedPnlValue: number;
  unrealizedPnlValue: number;
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
  strategyHealth: Array<{
    id: string;
    name: string;
    enabled: boolean;
    allocationPct: number;
    assignedCapital: number;
    availableCash: number;
    deployedCapital: number;
    utilizationPct: number;
    realizedPnl: number;
    unrealizedPnl: number;
    currentStatus: "disabled" | "managing_position" | "exit_monitoring" | "blocked" | "waiting" | "ready" | "inactive";
    openPositions: number;
    lastEvaluatedAt: string | null;
    lastSignalAt: string | null;
    lastSignalAction: string | null;
    lastSignalReason: string | null;
    lastTradeAt: string | null;
    lastBuyAt: string | null;
    dcaIntervalHours: number | null;
    exitMonitoredPositions: number;
    stalledExitCount: number;
    latestExitAt: string | null;
    latestExitReasonCode: string | null;
    latestExitReasonDetail: string | null;
    blockingReasonCode: string | null;
    blockingReasonDetail: string | null;
    nextEligibleAt: string | null;
    latestLifecycleStage: string | null;
    latestLifecycleStatus: string | null;
  }>;
  botHealth: {
    overallStatus: "healthy" | "warning" | "critical" | "unknown";
    runtimeStatus: string;
    pipelineStatus: string;
    mode: TradingMode;
    activeStrategies: number;
    activePositions: number;
    criticalDiagnosticsCount: number;
    lastSuccessfulTradeAt: string | null;
    quietReasonCode: string;
    quietReason: string;
    marketData: {
      status: "fresh" | "warning" | "stale" | "unknown";
      lastAt: string | null;
      ageSeconds: number | null;
      tradeTicksRecent: number;
      bboUpdatesRecent: number;
    };
    reconciliation: {
      status: "healthy" | "warning" | "critical";
      mismatchCount: number;
      scopeCount: number;
      bucketCount: number;
      externalErrorCount: number;
      topMismatchTypes: Array<{ type: string; count: number }>;
    };
    paperLive: {
      currentMode: TradingMode;
      canSwitchToLive: boolean;
      liveReadinessReason: string | null;
      strictPaperModeAvailable: boolean;
      paperWarning: string;
      connectionStatus: string;
      checklist: Array<{
        id: string;
        label: string;
        passed: boolean;
        detail: string | null;
      }>;
    };
  };
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
    exitStatus: "monitoring" | "triggered" | "requested" | "stalled" | null;
    exitStage: string | null;
    exitReasonCode: string | null;
    exitReasonDetail: string | null;
    exitUpdatedAt: string | null;
    exitStalled: boolean;
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
  capitalUtilization: {
    totalCapital: number;
    availableCash: number;
    reservedCash: number;
    lockedCapital: number;
    deployedCapital: number;
    totalDeployedPct: number;
    byStrategy: Array<{
      strategy: string;
      assignedCapital: number;
      availableCash: number;
      reservedCash: number;
      lockedCapital: number;
      deployedCapital: number;
      utilizationPct: number;
    }>;
    avgTradeSizeByStrategy: Array<{ strategy: string; avgTradeSize: number }>;
  };
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
