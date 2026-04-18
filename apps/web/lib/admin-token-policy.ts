"use client";

import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export type TokenMarketProfile = {
  liquidity_score: number;
  spread_score: number;
  volatility_score: number;
  trend_score: number;
  reversion_score: number;
  slippage_score: number;
  avg_daily_volume_usd: number;
  avg_spread_pct: number;
  avg_intraday_volatility_pct: number;
  last_computed_at: string;
  raw_metrics_json?: Record<string, unknown> | null;
};

export type TokenPolicyToken = {
  id: string;
  symbol: string;
  quote_currency: string;
  display_name: string | null;
  is_enabled: boolean;
  extra?: Record<string, unknown> | null;
};

export type TokenStrategyPolicy = {
  id: string;
  strategy_id: string;
  strategy_display_name: string | null;
  admin_enabled: boolean;
  suitability_score: number;
  computed_recommendation_status: string;
  computed_recommendation_reason: string | null;
  effective_recommendation_status: string;
  effective_recommendation_reason: string | null;
  recommendation_status: string;
  recommendation_reason: string | null;
  recommendation_status_override: string | null;
  recommendation_reason_override: string | null;
  max_position_pct_override: number | null;
  notes: string | null;
  computed_at: string | null;
  updated_at: string | null;
};

export type TokenPolicyMatrixEntry = {
  token: TokenPolicyToken;
  market_profile: TokenMarketProfile | null;
  strategy_policies: TokenStrategyPolicy[];
};

export type TokenPolicyDecision = {
  record_id: string;
  enforced_in: string;
  strategy_name: string;
  token: string;
  trading_mode: string;
  computed_recommendation_status: string;
  effective_recommendation_status: string;
  admin_enabled: boolean;
  confidence_score: number | null;
  final_sizing_impact: {
    original_size?: string | null;
    final_size?: string | null;
    size_multiplier?: string | null;
    max_position_pct_override?: string | null;
    requested_quantity?: string | null;
  };
  decision_outcome: "emitted" | "reduced" | "rejected" | "executed";
  decision_reason: string | null;
  timestamp: string;
};

export type TokenPolicyOverrideInput = {
  admin_enabled?: boolean;
  recommendation_status?: "preferred" | "allowed" | "discouraged" | "blocked" | null;
  recommendation_reason?: string | null;
  max_position_pct_override?: number | null;
  notes?: string | null;
};

type DecisionFilters = {
  symbol?: string;
  strategy_id?: string;
  trading_mode?: "paper" | "live";
  outcome?: "emitted" | "reduced" | "rejected" | "executed";
  limit?: number;
};

async function readJson<T>(path: string): Promise<{ data?: T; error?: string }> {
  const res = await authFetch(path);
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as T };
}

export async function fetchTokenMarketProfiles() {
  return readJson<Array<{ token: TokenPolicyToken; market_profile: TokenMarketProfile | null }>>(
    "/v1/admin/platform/token-policy/market-profiles",
  );
}

export async function fetchTokenPolicyMatrix(symbol?: string) {
  const query = symbol?.trim() ? `?symbol=${encodeURIComponent(symbol.trim())}` : "";
  return readJson<TokenPolicyMatrixEntry[]>(`/v1/admin/platform/token-policy/matrix${query}`);
}

export async function fetchTokenPolicyDetail(tokenId: string) {
  return readJson<TokenPolicyMatrixEntry>(`/v1/admin/platform/token-policy/tokens/${tokenId}`);
}

export async function updateTokenStrategyPolicy(
  tokenId: string,
  strategyId: string,
  payload: TokenPolicyOverrideInput,
) {
  const res = await authFetch(`/v1/admin/platform/tokens/${tokenId}/strategy-policies/${strategyId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as TokenStrategyPolicy };
}

export async function recalculateTokenPolicy(tokenId: string) {
  const res = await authFetch(`/v1/admin/platform/tokens/${tokenId}/recalculate-policy`, {
    method: "POST",
  });
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as TokenPolicyMatrixEntry };
}

export async function fetchTokenPolicyDecisions(filters: DecisionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.strategy_id) params.set("strategy_id", filters.strategy_id);
  if (filters.trading_mode) params.set("trading_mode", filters.trading_mode);
  if (filters.outcome) params.set("outcome", filters.outcome);
  params.set("limit", String(filters.limit ?? 100));
  const query = params.size ? `?${params.toString()}` : "";
  return readJson<TokenPolicyDecision[]>(`/v1/admin/platform/token-policy/decisions${query}`);
}
