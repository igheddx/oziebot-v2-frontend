"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { TradeCardsHybrid } from "@/components/dashboard/trade-cards-hybrid";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { getDashboardDetails, getDashboardOverview } from "@/lib/dashboard-api";
import type { DashboardDetails, DashboardOverview } from "@/lib/dashboard-types";
import { CardSkeleton, RowSkeleton, Skeleton } from "@/components/ui/skeleton";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatStageLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function DashboardScreen() {
  const { mode } = useTradingMode();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [details, setDetails] = useState<DashboardDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(
    async (forceRefresh = false) => {
      setError(null);
      setDetailsError(null);
      setIsRefreshing(true);
      try {
        const [nextOverview, nextDetails] = await Promise.all([
          getDashboardOverview(mode, { forceRefresh }),
          getDashboardDetails(mode, { forceRefresh }),
        ]);
        if (!nextOverview) {
          setOverview(null);
          setDetails(null);
          setError("Dashboard data is temporarily unavailable. Your trades and balances were not deleted.");
          return;
        }
        setOverview(nextOverview);

        if (!nextDetails) {
          setDetails(null);
          setDetailsError("Detailed dashboard panels are temporarily unavailable.");
          return;
        }
        setDetails(nextDetails);
      } catch {
        setOverview(null);
        setDetails(null);
        setError("Dashboard data is temporarily unavailable. Your trades and balances were not deleted.");
      } finally {
        setIsRefreshing(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    let mounted = true;
    void loadDashboard().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [loadDashboard]);

  const cards = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Available Balance", value: formatMoney(overview.availableBalance), tone: "neutral" },
      { label: "Portfolio", value: formatMoney(overview.portfolioValue), tone: "neutral" },
      {
        label: overview.gainLossLabel,
        value: formatMoney(overview.pnlValue),
        tone: overview.pnlValue >= 0 ? "positive" : "negative",
        detail: `${overview.pnlPercent >= 0 ? "+" : ""}${overview.pnlPercent.toFixed(2)}%`,
      },
      { label: "Active Positions", value: overview.positionsCount.toString(), tone: "neutral" },
      { label: "Fees (30d)", value: formatMoney(overview.totalFeesMonth), tone: "neutral" },
      {
        label: "Avg Net Edge",
        value: `${overview.avgNetEdgeAtEntryBps.toFixed(1)} bps`,
        tone: overview.avgNetEdgeAtEntryBps >= 0 ? "positive" : "negative",
      },
    ];
  }, [overview]);

  return (
    <AppShell title="Dashboard" subtitle="Portfolio, positions, and trades filtered by current mode.">
      {error ? (
        <section className="oz-panel border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {error}
        </section>
      ) : null}
      {detailsError ? (
        <section className="oz-panel border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {detailsError}
        </section>
      ) : null}
      <section className="flex items-center justify-end">
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-60"
          onClick={() => void loadDashboard(true)}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </section>
      {!overview ? (
        <>
          {error ? (
            <section className="oz-panel p-4 text-sm text-muted">Dashboard unavailable right now.</section>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-2">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </section>
              <div className="oz-panel p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-32 w-full" />
              </div>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          )}
        </>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2">
            {cards.map((card) => (
              <article key={card.label} className="oz-panel p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">{card.label}</p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    card.tone === "positive"
                      ? "text-positive"
                      : card.tone === "negative"
                        ? "text-negative"
                        : "text-foreground"
                  }`}
                >
                  {card.value}
                </p>
                {card.detail ? <p className="text-xs text-muted">{card.detail}</p> : null}
              </article>
            ))}
          </section>

          <GrowthChart values={overview.growth} positive={overview.pnlValue >= 0} />

          {!details ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Fee Drag</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Gross P&L", formatMoney(details.feeAnalytics.grossPnl)],
                    ["Net P&L", formatMoney(details.feeAnalytics.netPnl)],
                    ["Fees Today", formatMoney(details.feeAnalytics.totalFeesToday)],
                    ["Fees This Week", formatMoney(details.feeAnalytics.totalFeesWeek)],
                    ["Avg Slippage", `${details.feeAnalytics.avgEstimatedSlippageBps.toFixed(1)} bps`],
                    ["Skipped For Fees", details.feeAnalytics.skippedTradesDueToFees.toString()],
                  ].map(([label, value]) => (
                    <article key={label} className="oz-panel p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
                    </article>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Fill Mix</p>
                    <div className="mt-2 space-y-1 text-sm text-muted">
                      <p>Maker {details.feeAnalytics.makerCount}</p>
                      <p>Taker {details.feeAnalytics.takerCount}</p>
                      <p>Mixed {details.feeAnalytics.mixedCount}</p>
                    </div>
                  </article>
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Mode Comparison</p>
                    <div className="mt-2 space-y-2 text-sm text-muted">
                      {(["paper", "live"] as const).map((entryMode) => (
                        <div key={entryMode} className="rounded-lg bg-surface px-3 py-2">
                          <p className="font-semibold uppercase tracking-wide text-foreground">{entryMode}</p>
                          <p>Fees {formatMoney(details.feeAnalytics.paperLiveComparison[entryMode].fees)}</p>
                          <p>Net {formatMoney(details.feeAnalytics.paperLiveComparison[entryMode].netPnl)}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Fees by Strategy</p>
                    <div className="mt-2 space-y-2">
                      {details.feeAnalytics.feesByStrategy.slice(0, 4).map((row) => (
                        <div key={row.strategy} className="flex items-center justify-between text-sm">
                          <span className="text-muted">{row.strategy}</span>
                          <span className="font-semibold text-foreground">{formatMoney(row.fees)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Fees by Symbol</p>
                    <div className="mt-2 space-y-2">
                      {details.feeAnalytics.feesBySymbol.slice(0, 4).map((row) => (
                        <div key={row.symbol} className="flex items-center justify-between text-sm">
                          <span className="text-muted">{row.symbol}</span>
                          <span className="font-semibold text-foreground">{formatMoney(row.fees)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Trade Blockers</h2>
                <div className="grid grid-cols-2 gap-2">
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Recent Rejections</p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {details.rejectionDiagnostics.totalRejected}
                    </p>
                  </article>
                  {details.rejectionDiagnostics.byStage.slice(0, 3).map((row) => (
                    <article key={row.stage} className="oz-panel p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted">{formatStageLabel(row.stage)}</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{row.count}</p>
                    </article>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Top Rejection Reasons</p>
                    <div className="mt-2 space-y-2">
                      {details.rejectionDiagnostics.breakdown.length === 0 ? (
                        <p className="text-sm text-muted">No persisted rejection reasons in this mode yet.</p>
                      ) : (
                        details.rejectionDiagnostics.breakdown.map((row) => (
                          <div key={`${row.stage}-${row.reasonCode}`} className="rounded-lg bg-surface px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{row.reasonCode}</p>
                                <p className="text-xs uppercase tracking-wide text-muted">
                                  {formatStageLabel(row.stage)}
                                </p>
                              </div>
                              <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase text-muted">
                                {row.count}
                              </span>
                            </div>
                            {row.latestDetail ? <p className="mt-2 text-xs text-muted">{row.latestDetail}</p> : null}
                            <p className="mt-2 text-[11px] text-muted">
                              {[row.strategies.join(", "), row.symbols.join(", ")].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                  <article className="oz-panel p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Latest Rejections</p>
                    <div className="mt-2 space-y-2">
                      {details.rejectionDiagnostics.recent.length === 0 ? (
                        <p className="text-sm text-muted">No recent persisted rejection events in this mode.</p>
                      ) : (
                        details.rejectionDiagnostics.recent.map((row, index) => (
                          <div
                            key={`${row.stage}-${row.reasonCode}-${row.createdAt}-${index}`}
                            className="rounded-lg bg-surface px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">{row.symbol ?? "Unknown symbol"}</p>
                              <span className="text-[10px] uppercase tracking-wide text-muted">
                                {formatStageLabel(row.stage)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              {[row.strategy, row.reasonCode].filter(Boolean).join(" · ")}
                            </p>
                            {row.reasonDetail ? <p className="mt-2 text-xs text-muted">{row.reasonDetail}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Enabled Strategies</h2>
                <div className="space-y-2">
                  {details.enabledStrategies
                    .filter((item) => item.enabled)
                    .map((item) => (
                      <div key={item.id} className="oz-panel flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-muted">Allocation {item.allocationPct}%</p>
                        </div>
                        <span className="rounded-full bg-positive/15 px-2 py-1 text-[10px] font-semibold text-positive">
                          ENABLED
                        </span>
                      </div>
                    ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Active Positions</h2>
                <div className="space-y-2">
                  {details.positions.map((position) => (
                    <article key={position.id} className="oz-panel p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-sm font-semibold">{position.symbol}</p>
                        <span className="text-xs text-muted">{position.strategy}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                        <span>Qty {position.quantity}</span>
                        <span className="text-center">${position.markPrice.toLocaleString()}</span>
                        <span className="text-right">{formatMoney(position.exposure)}</span>
                      </div>
                      <p
                        className={`mt-2 text-sm font-semibold ${
                          position.unrealizedPnl >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        Unrealized {formatMoney(position.unrealizedPnl)}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <TradeCardsHybrid activeTrades={details.activeTrades} recent={details.recentActivity} />
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
