"use client";

import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export type TradingDiagnosticsFilters = {
  days?: number;
  token?: string;
  strategy?: string;
  trading_mode?: "paper" | "live";
  limit?: number;
};

export type TradingDiagnosticsTradeDetail = {
  trade_id: string;
  strategy: string;
  token: string;
  trading_mode: string;
  entry_time: string | null;
  exit_time: string | null;
  hold_minutes: number | null;
  entry_price: number | null;
  exit_price: number | null;
  quantity: number | null;
  size_usd: number | null;
  fees_usd: number | null;
  gross_pnl_usd: number | null;
  net_pnl_usd: number | null;
  pnl_pct: number | null;
  exit_reason: string | null;
  partial_profit_taken: boolean | null;
  max_favorable_excursion_pct: number | null;
  max_adverse_excursion_pct: number | null;
  peak_unrealized_pnl_pct: number | null;
  profit_giveback_pct: number | null;
  signal_confidence: number | null;
  volume_confirmation_passed: boolean | null;
  rejected_before_execution: boolean | null;
};

export type TradingDiagnosticsStrategySummary = {
  strategy: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number | null;
  avg_win_pct: number | null;
  avg_loss_pct: number | null;
  profit_factor: number | null;
  total_net_pnl_usd: number | null;
  total_net_pnl_pct: number | null;
  max_drawdown_pct: number | null;
  avg_hold_minutes: number | null;
  stop_loss_exits: number;
  take_profit_exits: number;
  trailing_stop_exits: number;
  partial_profit_exits: number;
  max_hold_exits: number;
  bearish_signal_exits: number;
  avg_profit_giveback_pct: number | null;
};

export type TradingDiagnosticsTokenSummary = {
  token: string;
  total_trades: number;
  win_rate_pct: number | null;
  total_net_pnl_usd: number | null;
  total_net_pnl_pct: number | null;
  avg_trade_return_pct: number | null;
  avg_hold_minutes: number | null;
  avg_profit_giveback_pct: number | null;
  best_strategy: string | null;
  worst_strategy: string | null;
};

export type TradingDiagnosticsExecutionDetail = {
  execution_trade_id: string;
  order_id: string;
  strategy: string;
  token: string;
  trading_mode: string;
  side: string;
  executed_at: string | null;
  quantity: number | null;
  price_usd: number | null;
  notional_usd: number | null;
  fees_usd: number | null;
  realized_pnl_usd: number | null;
  position_quantity_after: number | null;
  position_closed: boolean;
};

export type TradingDiagnosticsExecutionStrategySummary = {
  strategy: string;
  trading_mode: string;
  total_executions: number;
  buy_executions: number;
  sell_executions: number;
  flattened_executions: number;
  total_notional_usd: number | null;
  total_fees_usd: number | null;
  total_realized_pnl_usd: number | null;
  last_executed_at: string | null;
};

export type TradingDiagnosticsExecutionTokenSummary = {
  token: string;
  trading_mode: string;
  total_executions: number;
  buy_executions: number;
  sell_executions: number;
  flattened_executions: number;
  total_notional_usd: number | null;
  total_fees_usd: number | null;
  total_realized_pnl_usd: number | null;
  last_executed_at: string | null;
};

export type TradingDiagnosticsExecutionActivity = {
  execution_count: number;
  flattened_trade_count: number;
  buy_count: number;
  sell_count: number;
  unique_tokens: number;
  total_notional_usd: number | null;
  total_fees_usd: number | null;
  total_realized_pnl_usd: number | null;
  data_source: string;
  note: string | null;
  strategy_summary: TradingDiagnosticsExecutionStrategySummary[];
  token_summary: TradingDiagnosticsExecutionTokenSummary[];
  execution_details: TradingDiagnosticsExecutionDetail[];
};

export type TradingDiagnosticsOpenPosition = {
  position_id: string;
  strategy: string;
  token: string;
  trading_mode: string;
  quantity: number | null;
  avg_entry_price: number | null;
  position_notional_usd: number | null;
  realized_pnl_usd: number | null;
  opened_at: string | null;
  last_trade_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
};

export type TradingDiagnosticsOpenPositions = {
  position_count: number;
  unique_tokens: number;
  total_position_notional_usd: number | null;
  total_realized_pnl_usd: number | null;
  exposure_by_strategy: Record<string, number | null>;
  data_source: string;
  note: string | null;
  positions: TradingDiagnosticsOpenPosition[];
};

export type TradingDiagnosticsSignalFunnel = {
  signals_evaluated: number | null;
  signals_emitted: number | null;
  signals_rejected: number | null;
  trades_executed: number;
  rejection_reasons: Record<string, number | null>;
  data_sources: Record<string, string>;
  unavailable_metrics: string[];
  note: string | null;
};

export type TradingDiagnosticsCapitalUtilization = {
  total_account_value: number | null;
  avg_capital_deployed_pct: number | null;
  peak_capital_deployed_pct: number | null;
  avg_cash_idle_pct: number | null;
  capital_by_strategy: Record<string, number | null>;
  note: string | null;
};

export type TradingDiagnosticsExitAnalysis = {
  most_common_exit_reason: string | null;
  stop_loss_rate_pct: number | null;
  avg_profit_before_trailing_exit_pct: number | null;
  avg_profit_before_reversal_pct: number | null;
  partial_take_profit_effectiveness_pct: number | null;
  trades_that_were_positive_before_loss_pct: number | null;
};

export type TradingDiagnosticsActiveConfig = {
  momentum_config: Record<string, unknown> | null;
  day_trading_config: Record<string, unknown> | null;
  reversion_config: Record<string, unknown> | null;
  dca_config: Record<string, unknown> | null;
  signal_rules: Record<string, Record<string, unknown>>;
  token_strategy_policy_matrix: Record<string, Record<string, unknown>>;
  default_missing_policy_behavior: "allowed" | "blocked";
};

export type TradingDiagnosticsReport = {
  generated_at: string;
  trade_count: number;
  trade_details: TradingDiagnosticsTradeDetail[];
  strategy_summary: TradingDiagnosticsStrategySummary[];
  token_summary: TradingDiagnosticsTokenSummary[];
  execution_activity: TradingDiagnosticsExecutionActivity;
  open_positions: TradingDiagnosticsOpenPositions;
  signal_funnel: TradingDiagnosticsSignalFunnel;
  capital_utilization: TradingDiagnosticsCapitalUtilization;
  exit_analysis: TradingDiagnosticsExitAnalysis;
  active_strategy_config: TradingDiagnosticsActiveConfig;
};

function buildQuery(filters: TradingDiagnosticsFilters = {}) {
  const params = new URLSearchParams();
  params.set("days", String(filters.days ?? 7));
  params.set("limit", String(filters.limit ?? 100));
  if (filters.token?.trim()) params.set("token", filters.token.trim());
  if (filters.strategy?.trim()) params.set("strategy", filters.strategy.trim());
  if (filters.trading_mode) params.set("trading_mode", filters.trading_mode);
  return params.toString();
}

async function readJson<T>(path: string): Promise<{ data?: T; error?: string }> {
  const res = await authFetch(path);
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as T };
}

export async function fetchAdminTradingDiagnostics(filters: TradingDiagnosticsFilters = {}) {
  const query = buildQuery(filters);
  return readJson<TradingDiagnosticsReport>(`/v1/admin/trading-diagnostics?${query}`);
}

export async function downloadAdminTradingDiagnosticsCsv(filters: TradingDiagnosticsFilters = {}) {
  const query = buildQuery(filters);
  const res = await authFetch(`/v1/admin/trading-diagnostics/export?format=csv&${query}`, {
    method: "GET",
  });
  if (!res) return { ok: false as const, message: "Could not reach API." };
  if (!res.ok) return { ok: false as const, message: await parseErrorMessage(res) };

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "trading-diagnostics.csv";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true as const };
}
