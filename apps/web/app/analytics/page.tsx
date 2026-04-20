"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { getTradeReviewAnalytics } from "@/lib/analytics-api";
import type { AnalyticsRow, ReviewAnalyticsPayload } from "@/lib/analytics-types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatStageLabel(value: string) {
  return value.replaceAll("_", " ");
}

function toneClass(value: number) {
  if (value > 0) return "text-positive";
  if (value < 0) return "text-negative";
  return "text-foreground";
}

function matrixTone(row: AnalyticsRow) {
  if (row.totalRealizedPnl > 0 && row.winRatePct >= 50) return "bg-positive/10 border-positive/20";
  if (row.totalRealizedPnl < 0 || row.winRatePct < 40) return "bg-negative/10 border-negative/20";
  return "bg-surface border-border";
}

export default function AnalyticsPage() {
  const { mode } = useTradingMode();
  const [analytics, setAnalytics] = useState<ReviewAnalyticsPayload | null>(null);
  const [strategyFilter, setStrategyFilter] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    let mounted = true;
    getTradeReviewAnalytics(mode, {
      strategyName: strategyFilter || undefined,
      symbol: symbolFilter || undefined,
      rangeDays,
    }).then((payload) => {
      if (mounted) setAnalytics(payload);
    });
    return () => {
      mounted = false;
    };
  }, [mode, rangeDays, strategyFilter, symbolFilter]);

  const topCards = useMemo(() => {
    if (!analytics) return [];
    return [
      {
        label: "Evaluated",
        value: analytics.summary.evaluated.toString(),
        detail: `${analytics.summary.emitted} emitted`,
      },
      {
        label: "Rejected",
        value: analytics.summary.rejected.toString(),
        detail: formatPercent(analytics.summary.rejectionRatePct),
      },
      {
        label: "Executed",
        value: analytics.summary.executed.toString(),
        detail: `${formatPercent(analytics.summary.executionRatePct)} of emitted`,
      },
      {
        label: "Profitable",
        value: analytics.summary.profitable.toString(),
        detail: formatPercent(analytics.summary.profitabilityRatePct),
      },
      {
        label: "Realized P&L",
        value: formatMoney(analytics.summary.totalRealizedPnl),
        detail: formatMoney(analytics.summary.totalFees),
      },
      {
        label: "Avg Hold",
        value: `${analytics.summary.avgHoldMinutes.toFixed(1)} min`,
        detail: `${analytics.summary.avgSlippagePct.toFixed(3)}% slippage`,
      },
    ];
  }, [analytics]);

  return (
    <AppShell
      title="Analytics Review"
      subtitle="Review the signal funnel, blockers, and strategy/token performance without changing live decisioning."
    >
      {!analytics ? (
        <section className="space-y-3">
          <div className="oz-panel p-4">Loading analytics...</div>
        </section>
      ) : (
        <>
          <section className="grid gap-2 md:grid-cols-3">
            {topCards.map((card) => (
              <article key={card.label} className="oz-panel p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">{card.label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{card.value}</p>
                <p className="text-xs text-muted">{card.detail}</p>
              </article>
            ))}
          </section>

          <section className="oz-panel p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Filters</h2>
                <p className="text-xs text-muted">Focus on a strategy, symbol, or recent window.</p>
              </div>
              {analytics.summary.overFilteringFlag ? (
                <div className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                  Over-filtering risk
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select
                value={strategyFilter}
                onChange={(event) => setStrategyFilter(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All strategies</option>
                {analytics.availableStrategies.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy}
                  </option>
                ))}
              </select>
              <select
                value={symbolFilter}
                onChange={(event) => setSymbolFilter(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All symbols</option>
                {analytics.availableSymbols.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
              <select
                value={rangeDays}
                onChange={(event) => setRangeDays(Number(event.target.value))}
                className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Signal Funnel</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {analytics.signalFunnel.length === 0 ? (
                <article className="oz-panel p-3 text-sm text-muted">No strategy funnel data yet.</article>
              ) : (
                analytics.signalFunnel.map((row) => (
                  <article key={`${row.strategyName}-${row.tradingMode}`} className="oz-panel p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{row.strategyName}</p>
                        <p className="text-xs uppercase tracking-wide text-muted">{row.tradingMode}</p>
                      </div>
                      {row.overFilteringFlag ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-amber-200">
                          review
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                      <div>Eval {row.evaluated}</div>
                      <div>Emit {row.emitted}</div>
                      <div>Exec {row.executed}</div>
                      <div>Reject {row.rejected}</div>
                      <div>Reduce {row.reduced}</div>
                      <div>Profit {row.profitable}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-surface px-2 py-2">
                        <p className="text-muted">Reject rate</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatPercent(row.rejectionRatePct)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface px-2 py-2">
                        <p className="text-muted">Exec rate</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatPercent(row.executionRatePct)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface px-2 py-2">
                        <p className="text-muted">Profit rate</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatPercent(row.profitabilityRatePct)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Strategy Performance</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {analytics.strategyPerformance.map((row) => (
                <article key={`${row.strategyName}-${row.tradingMode}`} className="oz-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.strategyName}</p>
                      <p className="text-xs uppercase tracking-wide text-muted">{row.tradingMode}</p>
                    </div>
                    {row.needsReview ? (
                      <span className="rounded-full bg-negative/15 px-2 py-1 text-[10px] font-semibold uppercase text-negative">
                        needs review
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Win rate</p>
                      <p className="mt-1 font-semibold text-foreground">{formatPercent(row.winRatePct)}</p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Return</p>
                      <p className={`mt-1 font-semibold ${toneClass(row.realizedReturnPct)}`}>
                        {formatPercent(row.realizedReturnPct)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Avg win / loss</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatMoney(row.avgWin)} / {formatMoney(row.avgLoss)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Fees / slip</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatMoney(row.totalFees)} / {row.avgSlippagePct.toFixed(3)}%
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Rejection Reasons</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <article className="oz-panel p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">By stage</p>
                <div className="mt-2 space-y-2">
                  {analytics.rejectionBreakdown.byStage.map((row) => (
                    <div key={row.stage} className="flex items-center justify-between text-sm">
                      <span className="text-muted">{formatStageLabel(row.stage)}</span>
                      <span className="font-semibold text-foreground">{row.count}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="oz-panel p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">Top reasons</p>
                <div className="mt-2 space-y-2">
                  {analytics.rejectionBreakdown.rows.slice(0, 8).map((row) => (
                    <div key={`${row.stage}-${row.reasonCode}`} className="rounded-xl bg-surface px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{row.reasonCode}</p>
                          <p className="text-xs uppercase tracking-wide text-muted">
                            {formatStageLabel(row.stage)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{row.count}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {[row.strategies.join(", "), row.symbols.join(", ")].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Token × Strategy Matrix
            </h2>
            <div className="space-y-2">
              {analytics.pairPerformance.length === 0 ? (
                <article className="oz-panel p-3 text-sm text-muted">
                  No strategy-token outcome history yet.
                </article>
              ) : (
                analytics.pairPerformance.map((row) => (
                  <article
                    key={`${row.strategyName}-${row.symbol}-${row.tradingMode}`}
                    className={`oz-panel border ${matrixTone(row)} p-3`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {row.strategyName} · {row.symbol}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-muted">{row.tradingMode}</p>
                      </div>
                      {row.needsReview ? (
                        <span className="rounded-full bg-negative/15 px-2 py-1 text-[10px] font-semibold uppercase text-negative">
                          reduce/block review
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-background/40 px-3 py-2">
                        <p className="text-muted">P&L</p>
                        <p className={`mt-1 font-semibold ${toneClass(row.totalRealizedPnl)}`}>
                          {formatMoney(row.totalRealizedPnl)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/40 px-3 py-2">
                        <p className="text-muted">Win rate</p>
                        <p className="mt-1 font-semibold text-foreground">{formatPercent(row.winRatePct)}</p>
                      </div>
                      <div className="rounded-xl bg-background/40 px-3 py-2">
                        <p className="text-muted">Reject rate</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatPercent(row.rejectionRatePct)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/40 px-3 py-2">
                        <p className="text-muted">Fees</p>
                        <p className="mt-1 font-semibold text-foreground">{formatMoney(row.totalFees)}</p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Paper vs Live</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {analytics.paperLiveComparison.overview.map((row) => (
                <article key={row.tradingMode} className="oz-panel p-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    {row.tradingMode}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>Trades {row.tradeCount}</div>
                    <div>Win {formatPercent(row.winRatePct)}</div>
                    <div>P&L {formatMoney(row.totalRealizedPnl)}</div>
                    <div>Fees {formatMoney(row.totalFees)}</div>
                    <div>Slip {row.avgSlippagePct.toFixed(3)}%</div>
                    <div>Hold {row.avgHoldMinutes.toFixed(1)} min</div>
                  </div>
                </article>
              ))}
            </div>
            <div className="space-y-2">
              {analytics.paperLiveComparison.strategies.map((row) => (
                <article key={row.strategyName} className="oz-panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.strategyName}</p>
                      <p className="text-xs text-muted">
                        Paper vs live gap for win rate, return, fees, and slippage.
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${toneClass(row.deltas.realizedReturnPct)}`}>
                      {row.deltas.realizedReturnPct >= 0 ? "+" : ""}
                      {row.deltas.realizedReturnPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Paper</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {row.paper ? formatPercent(row.paper.winRatePct) : "n/a"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Live</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {row.live ? formatPercent(row.live.winRatePct) : "n/a"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Fee delta</p>
                      <p className={`mt-1 font-semibold ${toneClass(-row.deltas.totalFees)}`}>
                        {formatMoney(row.deltas.totalFees)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Slip delta</p>
                      <p className={`mt-1 font-semibold ${toneClass(-row.deltas.avgSlippagePct)}`}>
                        {row.deltas.avgSlippagePct.toFixed(3)}%
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
