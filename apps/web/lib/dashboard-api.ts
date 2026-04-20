import {
  mockAlerts,
  mockAllocation,
  mockBillingSummary,
  mockCoinbaseConnection,
  mockTokens,
} from "@/lib/mock-data";
import type {
  AlertConfig,
  AllocationItem,
  BillingSummary,
  CoinbaseConnection,
  DashboardSummary,
  TokenItem,
  TradingMode,
} from "@/lib/dashboard-types";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";

const ENABLE_MOCK_FALLBACKS =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACKS === "true" ||
  (process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACKS == null && process.env.NODE_ENV !== "production");

type RequestOptions = {
  mode?: TradingMode;
  method?: "GET" | "POST" | "PATCH" | "PUT";
  body?: unknown;
};

type CoinbaseConnectionPayload = {
  id: string;
  provider: string;
  api_key_name_masked: string;
  validation_status: string;
  health_status: string | null;
  last_validated_at: string | null;
  last_health_check_at: string | null;
  last_error: string | null;
  can_trade: boolean | null;
  can_read_balances: boolean | null;
  created_at: string;
  updated_at: string;
};

type CoinbaseConnectionStatusPayload =
  | ({ connected: true } & CoinbaseConnectionPayload)
  | {
      connected: false;
      provider?: string;
      api_key_name_masked?: string | null;
      validation_status?: string | null;
      health_status?: string | null;
      last_validated_at?: string | null;
      last_health_check_at?: string | null;
      last_error?: string | null;
      can_trade?: boolean | null;
      can_read_balances?: boolean | null;
      created_at?: string | null;
      updated_at?: string | null;
    };
function withModePath(path: string, mode?: TradingMode): string {
  const separator = path.includes("?") ? "&" : "?";
  return mode ? `${path}${separator}trading_mode=${mode}` : path;
}

async function requestWithAuth(path: string, options: RequestOptions = {}): Promise<Response | null> {
  const { mode, method = "GET", body } = options;
  return authFetch(withModePath(path, mode), {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mapCoinbaseConnection(payload: CoinbaseConnectionPayload): CoinbaseConnection {
  return {
    id: payload.id,
    provider: payload.provider,
    apiKeyNameMasked: payload.api_key_name_masked,
    validationStatus: payload.validation_status,
    healthStatus: payload.health_status,
    lastValidatedAt: payload.last_validated_at,
    lastHealthCheckAt: payload.last_health_check_at,
    lastError: payload.last_error,
    canTrade: payload.can_trade,
    canReadBalances: payload.can_read_balances,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

async function readApiError(res: Response): Promise<string> {
  return parseErrorMessage(res);
}

async function fetchJson<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const res = await requestWithAuth(path, options);
  if (!res || !res.ok) return null;
  return (await res.json()) as T;
}

function normalizePemInput(rawPem: string): string {
  let value = rawPem.trim();
  // If users paste JSON-escaped PEM, convert literal "\\n" into real line breaks.
  value = value.replace(/\\n/g, "\n");
  // Some clipboard tools include wrapping quotes around multi-line values.
  value = value.replace(/^"|"$/g, "");
  return value;
}

export async function upsertCoinbaseConnection(
  mode: TradingMode,
  apiKeyName: string,
  apiSecretPem: string,
): Promise<{ connection?: CoinbaseConnection; error?: string }> {
  const body = { api_key_name: apiKeyName, api_secret_pem: normalizePemInput(apiSecretPem) };

  const createRes = await requestWithAuth("/v1/integrations/coinbase", {
    mode,
    method: "POST",
    body,
  });
  if (!createRes) return { error: "Could not reach API" };
  if (createRes.ok) {
    const payload = (await createRes.json()) as CoinbaseConnectionPayload;
    return { connection: mapCoinbaseConnection(payload) };
  }

  if (createRes.status !== 409) {
    return { error: await readApiError(createRes) };
  }

  const patchRes = await requestWithAuth("/v1/integrations/coinbase", {
    mode,
    method: "PATCH",
    body,
  });
  if (!patchRes) return { error: "Could not reach API" };
  if (!patchRes.ok) return { error: await readApiError(patchRes) };

  const payload = (await patchRes.json()) as CoinbaseConnectionPayload;
  return { connection: mapCoinbaseConnection(payload) };
}

export async function getDashboardSummary(mode: TradingMode): Promise<DashboardSummary | null> {
  const payload = await fetchJson<DashboardSummary>("/v1/me/dashboard", { mode });
  if (!payload) return null;
  return {
    availableBalance: payload.availableBalance ?? payload.portfolioValue,
    portfolioValue: payload.portfolioValue,
    pnlValue: payload.pnlValue,
    pnlPercent: payload.pnlPercent,
    gainLossLabel: payload.gainLossLabel ?? "P&L",
    growth: payload.growth ?? [],
    enabledStrategies: payload.enabledStrategies ?? [],
    positions: payload.positions ?? [],
    activeTrades: payload.activeTrades ?? [],
    recentActivity: payload.recentActivity ?? [],
    feeAnalytics: payload.feeAnalytics ?? {
      grossPnl: 0,
      netPnl: 0,
      totalFeesToday: 0,
      totalFeesWeek: 0,
      totalFeesMonth: 0,
      feesByStrategy: [],
      feesBySymbol: [],
      makerCount: 0,
      takerCount: 0,
      mixedCount: 0,
      avgEstimatedSlippageBps: 0,
      avgNetEdgeAtEntryBps: 0,
      skippedTradesDueToFees: 0,
      paperLiveComparison: {
        paper: { fees: 0, netPnl: 0 },
        live: { fees: 0, netPnl: 0 },
      },
    },
    rejectionDiagnostics: payload.rejectionDiagnostics ?? {
      totalRejected: 0,
      byStage: [],
      breakdown: [],
      recent: [],
    },
  };
}

export async function getTokens(mode: TradingMode): Promise<TokenItem[]> {
  const payload = await fetchJson<{
    tokens: Array<{
      platform_token_id: string;
      is_enabled: boolean;
      token: {
        symbol: string;
        quote_currency: string;
        display_name: string | null;
      };
    }>;
  }>("/v1/me/tokens", { mode });
  if (!payload) return ENABLE_MOCK_FALLBACKS ? mockTokens(mode) : [];
  return payload.tokens.map((item) => ({
    id: item.platform_token_id,
    symbol: item.token.symbol,
    quote: item.token.quote_currency,
    name: item.token.display_name ?? item.token.symbol,
    enabled: item.is_enabled,
    volatility: "medium",
  }));
}

export async function getAllocation(mode: TradingMode): Promise<AllocationItem[]> {
  const [plan, buckets] = await Promise.all([
    fetchJson<{
      items: Array<{ strategy_id: string; allocation_bps: number }>;
    }>(`/v1/me/allocations/${mode}`, { mode }),
    fetchJson<{
      buckets: Array<{ strategy_id: string; available_cash_cents: number }>;
    }>(`/v1/me/allocations/${mode}/buckets`, { mode }),
  ]);
  if (!plan || !buckets) return ENABLE_MOCK_FALLBACKS ? mockAllocation() : [];
  const bucketByStrategy = new Map(buckets.buckets.map((b) => [b.strategy_id, b.available_cash_cents]));
  return plan.items.map((item) => ({
    strategyId: item.strategy_id,
    strategyName: item.strategy_id
      .split("-")
      .map((p) => p[0]?.toUpperCase() + p.slice(1))
      .join(" "),
    percent: item.allocation_bps / 100,
    availableCash: (bucketByStrategy.get(item.strategy_id) ?? 0) / 100,
  }));
}

export async function getAlerts(mode: TradingMode): Promise<AlertConfig> {
  const payload = await fetchJson<AlertConfig>("/v1/alerts/config", { mode });
  return payload ?? (ENABLE_MOCK_FALLBACKS ? mockAlerts() : {
    push: false,
    email: false,
    tradeFilled: false,
    drawdown: false,
    orderFailed: false,
  });
}

export async function getBillingSummary(mode: TradingMode): Promise<BillingSummary> {
  const payload = await fetchJson<{
    trial_started_at: string | null;
    trial_ends_at: string | null;
    trial_active: boolean;
    subscription_status: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
  }>("/v1/billing/summary", { mode });
  if (!payload) {
    return ENABLE_MOCK_FALLBACKS
      ? mockBillingSummary()
      : {
          trialStartedAt: null,
          trialEndsAt: null,
          trialActive: false,
          subscriptionStatus: null,
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        };
  }
  return {
    trialStartedAt: payload.trial_started_at,
    trialEndsAt: payload.trial_ends_at,
    trialActive: payload.trial_active,
    subscriptionStatus: payload.subscription_status,
    stripeSubscriptionId: payload.stripe_subscription_id,
    currentPeriodEnd: payload.current_period_end,
  };
}

export async function getCoinbaseConnection(mode: TradingMode): Promise<CoinbaseConnection> {
  const payload = await fetchJson<CoinbaseConnectionStatusPayload>("/v1/integrations/coinbase/status", { mode });
  if (!payload) {
    return ENABLE_MOCK_FALLBACKS
      ? mockCoinbaseConnection()
      : {
          id: "not-connected",
          provider: "coinbase",
          apiKeyNameMasked: "Not connected",
          validationStatus: "not_connected",
          healthStatus: null,
          lastValidatedAt: null,
          lastHealthCheckAt: null,
          lastError: null,
          canTrade: null,
          canReadBalances: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
  }
  if (!payload.connected) {
    return {
      id: "not-connected",
      provider: payload.provider ?? "coinbase",
      apiKeyNameMasked: "Not connected",
      validationStatus: payload.validation_status ?? "not_connected",
      healthStatus: payload.health_status ?? null,
      lastValidatedAt: payload.last_validated_at ?? null,
      lastHealthCheckAt: payload.last_health_check_at ?? null,
      lastError: payload.last_error ?? null,
      canTrade: payload.can_trade ?? null,
      canReadBalances: payload.can_read_balances ?? null,
      createdAt: payload.created_at ?? new Date().toISOString(),
      updatedAt: payload.updated_at ?? new Date().toISOString(),
    };
  }
  return mapCoinbaseConnection(payload);
}
