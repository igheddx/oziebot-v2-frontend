"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  downloadAdminTradingDiagnosticsCsv,
  fetchAdminTradingDiagnostics,
  type TradingDiagnosticsFilters,
  type TradingDiagnosticsReport,
} from "@/lib/admin-trading-diagnostics";

const DAY_PRESETS = [1, 3, 7, 30] as const;
const STRATEGY_ORDER = ["momentum", "day_trading", "reversion", "dca"] as const;

type FilterState = {
  days: number;
  token: string;
  strategy: string;
  trading_mode: "" | "paper" | "live";
  limit: number;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "Unavailable";
  return `${value.toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null) return "Unavailable";
  return value.toFixed(digits);
}

function metricValue(value: number | null | undefined) {
  return value == null ? "Unavailable" : String(value);
}

export default function AdminTradingDiagnosticsPage() {
  const { role } = useAuth();
  const isRootAdmin = role === "root_admin";
  const [filters, setFilters] = useState<FilterState>({
    days: 7,
    token: "",
    strategy: "",
    trading_mode: "",
    limit: 100,
  });
  const [report, setReport] = useState<TradingDiagnosticsReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jsonBusy, setJsonBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  const requestFilters = useMemo<TradingDiagnosticsFilters>(
    () => ({
      days: filters.days,
      token: filters.token || undefined,
      strategy: filters.strategy || undefined,
      trading_mode: filters.trading_mode || undefined,
      limit: filters.limit,
    }),
    [filters],
  );

  const loadDiagnostics = useCallback(async () => {
    if (!isRootAdmin) return;
    setLoading(true);
    const response = await fetchAdminTradingDiagnostics(requestFilters);
    setLoading(false);
    if (response.error) {
      setStatus(response.error);
      setReport(null);
      return;
    }
    setReport(response.data ?? null);
    setStatus(null);
  }, [isRootAdmin, requestFilters]);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  const tokenOptions = useMemo(() => {
    const matrix = report?.active_strategy_config.token_strategy_policy_matrix ?? {};
    return Object.keys(matrix).sort();
  }, [report]);

  const strategyOptions = useMemo(() => {
    const configured = Object.keys(report?.active_strategy_config.signal_rules ?? {});
    return STRATEGY_ORDER.filter((strategy) => configured.includes(strategy));
  }, [report]);

  const totalNetPnl = useMemo(
    () => report?.trade_details.reduce((sum, trade) => sum + (trade.net_pnl_usd ?? 0), 0) ?? 0,
    [report],
  );
  const wins = useMemo(
    () => report?.trade_details.filter((trade) => (trade.net_pnl_usd ?? 0) > 0) ?? [],
    [report],
  );
  const losses = useMemo(
    () => report?.trade_details.filter((trade) => (trade.net_pnl_usd ?? 0) < 0) ?? [],
    [report],
  );

  const onExportJson = async () => {
    if (!report) return;
    setJsonBusy(true);
    try {
      const body = `${JSON.stringify(report, null, 2)}\n`;
      const blob = new Blob([body], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trading-diagnostics-${report.generated_at.replaceAll(":", "-")}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("JSON export downloaded.");
    } finally {
      setJsonBusy(false);
    }
  };

  const onExportCsv = async () => {
    setCsvBusy(true);
    const response = await downloadAdminTradingDiagnosticsCsv(requestFilters);
    setCsvBusy(false);
    setStatus(response.ok ? "CSV export downloaded." : response.message);
  };

  if (!isRootAdmin) {
    return (
      <AppShell title="Trading Diagnostics" subtitle="Root admin access is required.">
        <section className="oz-panel p-4 text-sm text-muted">
          This screen is only available to root admins because it exposes platform-wide trading diagnostics and export tools.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Trading Diagnostics"
      subtitle="Review recent completed trades, strategy performance, funnel consistency, and export the filtered report."
      showModeToggle={false}
    >
      <section className="oz-panel space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Filters</p>
              <p className="text-xs text-muted">
                Latest completed trades plus strategy, risk, execution, and capital telemetry.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, days: preset }))}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    filters.days === preset
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted"
                  }`}
                >
                  Last {preset} day{preset === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadDiagnostics()}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={!report || jsonBusy}
              onClick={() => void onExportJson()}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-50"
            >
              {jsonBusy ? "Preparing JSON..." : "Export JSON"}
            </button>
            <button
              type="button"
              disabled={csvBusy}
              onClick={() => void onExportCsv()}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-50"
            >
              {csvBusy ? "Preparing CSV..." : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Days
            <input
              type="number"
              min={1}
              max={365}
              value={filters.days}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  days: Math.min(365, Math.max(1, Number(event.target.value) || 7)),
                }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Token
            <select
              value={filters.token}
              onChange={(event) => setFilters((current) => ({ ...current, token: event.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              <option value="">All tokens</option>
              {tokenOptions.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Strategy
            <select
              value={filters.strategy}
              onChange={(event) => setFilters((current) => ({ ...current, strategy: event.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              <option value="">All strategies</option>
              {strategyOptions.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Trading mode
            <select
              value={filters.trading_mode}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  trading_mode: event.target.value as FilterState["trading_mode"],
                }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              <option value="">Paper + live</option>
              <option value="paper">Paper</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Limit
            <input
              type="number"
              min={1}
              max={100}
              value={filters.limit}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  limit: Math.min(100, Math.max(1, Number(event.target.value) || 100)),
                }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
        </div>

        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </section>

      {loading ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </section>
      ) : null}

      {!loading && !report ? (
        <section className="oz-panel p-4 text-sm text-muted">Diagnostics are unavailable right now.</section>
      ) : null}

      {!loading && report && report.trade_count === 0 ? (
        <section className="oz-panel p-4 text-sm text-muted">
          No completed trades matched the current filters.
        </section>
      ) : null}

      {!loading && report && report.trade_count > 0 ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="oz-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total trades</p>
              <p className="mt-2 text-2xl font-semibold">{report.trade_count}</p>
            </article>
            <article className="oz-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Win rate</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatPct(wins.length && report.trade_count ? (wins.length / report.trade_count) * 100 : 0)}
              </p>
            </article>
            <article className="oz-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total PnL</p>
              <p className={`mt-2 text-2xl font-semibold ${totalNetPnl >= 0 ? "text-positive" : "text-negative"}`}>
                {formatCurrency(totalNetPnl)}
              </p>
            </article>
            <article className="oz-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Average win / loss</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {formatPct(
                  wins.length ? wins.reduce((sum, trade) => sum + (trade.pnl_pct ?? 0), 0) / wins.length : null,
                )}{" "}
                /{" "}
                {formatPct(
                  losses.length
                    ? losses.reduce((sum, trade) => sum + (trade.pnl_pct ?? 0), 0) / losses.length
                    : null,
                )}
              </p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <article className="oz-panel space-y-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Signal funnel</p>
                <p className="text-xs text-muted">Unavailable values mean the upstream stage did not record matching telemetry.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted">Evaluated</p>
                  <p className="mt-2 text-lg font-semibold">{metricValue(report.signal_funnel.signals_evaluated)}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted">Emitted</p>
                  <p className="mt-2 text-lg font-semibold">{metricValue(report.signal_funnel.signals_emitted)}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted">Rejected</p>
                  <p className="mt-2 text-lg font-semibold">{metricValue(report.signal_funnel.signals_rejected)}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted">Trades executed</p>
                  <p className="mt-2 text-lg font-semibold">{report.signal_funnel.trades_executed}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(report.signal_funnel.rejection_reasons).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
                    <span className="font-semibold text-foreground">{key.replaceAll("_", " ")}</span>:{" "}
                    {metricValue(value)}
                  </div>
                ))}
              </div>
              {report.signal_funnel.note ? (
                <p className="text-sm text-amber-300">{report.signal_funnel.note}</p>
              ) : null}
            </article>

            <article className="oz-panel space-y-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Capital utilization</p>
                <p className="text-xs text-muted">
                  Based on current strategy capital buckets and recent ledger snapshots.
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Total account value</span>
                  <span className="font-semibold">{formatCurrency(report.capital_utilization.total_account_value)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Avg deployed</span>
                  <span className="font-semibold">{formatPct(report.capital_utilization.avg_capital_deployed_pct)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Peak deployed</span>
                  <span className="font-semibold">{formatPct(report.capital_utilization.peak_capital_deployed_pct)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Avg cash idle</span>
                  <span className="font-semibold">{formatPct(report.capital_utilization.avg_cash_idle_pct)}</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(report.capital_utilization.capital_by_strategy).map(([strategy, value]) => (
                  <div key={strategy} className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
                    <span className="font-semibold text-foreground">{strategy}</span>: {formatCurrency(value)}
                  </div>
                ))}
              </div>
              {report.capital_utilization.note ? (
                <p className="text-sm text-amber-300">{report.capital_utilization.note}</p>
              ) : null}
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="oz-panel space-y-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Strategy summary</p>
                <p className="text-xs text-muted">Grouped over the currently filtered completed trades.</p>
              </div>
              <div className="space-y-3">
                {report.strategy_summary.map((row) => (
                  <div key={row.strategy} className="rounded-2xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{row.strategy}</p>
                      <span className="text-xs text-muted">{row.total_trades} trades</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                      <div>Win rate: <span className="font-semibold">{formatPct(row.win_rate_pct)}</span></div>
                      <div>Total PnL: <span className="font-semibold">{formatCurrency(row.total_net_pnl_usd)}</span></div>
                      <div>Avg hold: <span className="font-semibold">{formatNumber(row.avg_hold_minutes)}</span></div>
                      <div>Profit factor: <span className="font-semibold">{formatNumber(row.profit_factor)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="oz-panel space-y-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Token summary</p>
                <p className="text-xs text-muted">Use this to spot strong and weak pair-strategy combinations.</p>
              </div>
              <div className="space-y-3">
                {report.token_summary.map((row) => (
                  <div key={row.token} className="rounded-2xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{row.token}</p>
                      <span className="text-xs text-muted">{row.total_trades} trades</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                      <div>Win rate: <span className="font-semibold">{formatPct(row.win_rate_pct)}</span></div>
                      <div>Total PnL: <span className="font-semibold">{formatCurrency(row.total_net_pnl_usd)}</span></div>
                      <div>Best strategy: <span className="font-semibold">{row.best_strategy ?? "Unavailable"}</span></div>
                      <div>Worst strategy: <span className="font-semibold">{row.worst_strategy ?? "Unavailable"}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="oz-panel space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Exit analysis</p>
              <p className="text-xs text-muted">Quick read on stop-losses, giveback, and partial profit behavior.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm">
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted">Most common exit</p>
                <p className="mt-2 font-semibold">{report.exit_analysis.most_common_exit_reason ?? "Unavailable"}</p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted">Stop-loss rate</p>
                <p className="mt-2 font-semibold">{formatPct(report.exit_analysis.stop_loss_rate_pct)}</p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted">Positive before loss</p>
                <p className="mt-2 font-semibold">
                  {formatPct(report.exit_analysis.trades_that_were_positive_before_loss_pct)}
                </p>
              </div>
            </div>
          </section>

          <section className="oz-panel space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Trade details</p>
              <p className="text-xs text-muted">Latest filtered completed trades, capped by the selected limit.</p>
            </div>
            <div className="space-y-3">
              {report.trade_details.map((trade) => (
                <article key={trade.trade_id} className="rounded-2xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {trade.token} / {trade.strategy}
                      </p>
                      <p className="text-xs text-muted">
                        {trade.trading_mode} · Exit {trade.exit_reason ?? "Unavailable"} · Hold {formatNumber(trade.hold_minutes)}
                        {" "}min
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${(trade.net_pnl_usd ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                      {formatCurrency(trade.net_pnl_usd)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div>Entry: <span className="font-semibold">{trade.entry_time ?? "Unavailable"}</span></div>
                    <div>Exit: <span className="font-semibold">{trade.exit_time ?? "Unavailable"}</span></div>
                    <div>PnL %: <span className="font-semibold">{formatPct(trade.pnl_pct)}</span></div>
                    <div>Fees: <span className="font-semibold">{formatCurrency(trade.fees_usd)}</span></div>
                    <div>Size: <span className="font-semibold">{formatCurrency(trade.size_usd)}</span></div>
                    <div>Confidence: <span className="font-semibold">{formatNumber(trade.signal_confidence, 3)}</span></div>
                    <div>MFE: <span className="font-semibold">{formatPct(trade.max_favorable_excursion_pct)}</span></div>
                    <div>Giveback: <span className="font-semibold">{formatPct(trade.profit_giveback_pct)}</span></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
