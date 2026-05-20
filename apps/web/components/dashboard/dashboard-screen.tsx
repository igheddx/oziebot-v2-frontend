"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { TradeCardsHybrid } from "@/components/dashboard/trade-cards-hybrid";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { getDashboardRejections, getDashboardSummary } from "@/lib/dashboard-api";
import type { DashboardDetails, DashboardOverview, DashboardRejections } from "@/lib/dashboard-types";
import { CardSkeleton, RowSkeleton, Skeleton } from "@/components/ui/skeleton";

const DISPLAY_EPSILON = 0.005;
const PAGE_SIZE = 5;

function normalizeDisplayValue(value: number) {
  return Math.abs(value) < DISPLAY_EPSILON ? 0 : value;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    normalizeDisplayValue(value),
  );
}

function formatStageLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatReasonLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatIntervalHours(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  return value === 1 ? "1 hour" : `${value} hours`;
}

function formatExitStatus(value: string | null | undefined) {
  if (!value) return null;
  return value === "stalled" ? "exit stalled" : value.replaceAll("_", " ");
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function toneClass(tone: "positive" | "negative" | "warning" | "neutral") {
  if (tone === "positive") return "text-positive";
  if (tone === "negative") return "text-negative";
  if (tone === "warning") return "text-amber-200";
  return "text-foreground";
}

function badgeClass(tone: "positive" | "negative" | "warning" | "neutral") {
  if (tone === "positive") return "border-positive/40 bg-positive/15 text-positive";
  if (tone === "negative") return "border-negative/40 bg-negative/15 text-negative";
  if (tone === "warning") return "border-amber-500/40 bg-amber-500/15 text-amber-100";
  return "border-border bg-surface text-muted";
}

function healthTone(status: string | null | undefined): "positive" | "warning" | "negative" | "neutral" {
  if (status === "healthy" || status === "fresh" || status === "ready" || status === "managing_position") {
    return "positive";
  }
  if (status === "warning" || status === "waiting" || status === "exit_monitoring") return "warning";
  if (status === "critical" || status === "blocked" || status === "stale") return "negative";
  return "neutral";
}

function formatPositionAge(ageHours: number | null) {
  if (ageHours == null) return "—";
  if (ageHours < 1) return `${Math.max(0, Math.round(ageHours * 60))}m`;
  if (ageHours < 24) return `${ageHours.toFixed(1)}h`;
  return `${(ageHours / 24).toFixed(1)}d`;
}

const REJECTION_WINDOWS = [1, 3, 6, 24, 48] as const;

export function DashboardScreen() {
  const { mode } = useTradingMode();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [details, setDetails] = useState<DashboardDetails | null>(null);
  const [rejections, setRejections] = useState<DashboardRejections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [rejectionsError, setRejectionsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [rejectionWindowHours, setRejectionWindowHours] = useState<DashboardRejections["windowHours"]>(24);
  const [positionSearch, setPositionSearch] = useState("");
  const [visiblePositionsCount, setVisiblePositionsCount] = useState(PAGE_SIZE);

  const loadRejections = useCallback(
    async (forceRefresh = false) => {
      setRejectionsError(null);
      try {
        const nextRejections = await getDashboardRejections(mode, rejectionWindowHours, { forceRefresh });
        if (!nextRejections) {
          setRejections(null);
          setRejectionsError("Trade blockers are temporarily unavailable.");
          return;
        }
        setRejections(nextRejections);
      } catch {
        setRejections(null);
        setRejectionsError("Trade blockers are temporarily unavailable.");
      }
    },
    [mode, rejectionWindowHours],
  );

  const loadDashboard = useCallback(
    async (forceRefresh = false): Promise<boolean> => {
      setError(null);
      setDetailsError(null);
      setIsRefreshing(true);
      try {
        const nextDashboard = await getDashboardSummary(mode, { forceRefresh });

        if (!nextDashboard) {
          setOverview(null);
          setDetails(null);
          setError("Dashboard data is temporarily unavailable. Your trades and balances were not deleted.");
          return false;
        }
        setOverview(nextDashboard);
        setDetails(nextDashboard);
        return true;
      } catch {
        setOverview(null);
        setDetails(null);
        setError("Dashboard data is temporarily unavailable. Your trades and balances were not deleted.");
        return false;
      } finally {
        setIsRefreshing(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    let mounted = true;
    setDashboardReady(false);
    setRejections(null);
    setRejectionsError(null);
    void loadDashboard(false).then((ok) => {
      if (!mounted) return;
      setDashboardReady(ok);
    });
    return () => {
      mounted = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!dashboardReady) return;
    void loadRejections(false);
  }, [dashboardReady, loadRejections]);

  const cards = useMemo(() => {
    if (!overview) return [];
    const normalizedPnlValue = normalizeDisplayValue(overview.pnlValue);
    const normalizedRealizedPnlValue = normalizeDisplayValue(overview.realizedPnlValue);
    const normalizedUnrealizedPnlValue = normalizeDisplayValue(overview.unrealizedPnlValue);
    const detailPositionsCount = details ? details.positions.length : null;
    const detailFeesMonth = details?.feeAnalytics.totalFeesMonth ?? null;
    const detailAvgNetEdge = details?.feeAnalytics.avgNetEdgeAtEntryBps ?? null;
    return [
      { label: "Available Balance", value: formatMoney(overview.availableBalance), tone: "neutral" },
      { label: "Portfolio", value: formatMoney(overview.portfolioValue), tone: "neutral" },
      {
        label: overview.gainLossLabel,
        value: formatMoney(normalizedPnlValue),
        tone: normalizedPnlValue === 0 ? "neutral" : normalizedPnlValue > 0 ? "positive" : "negative",
        detail: `${overview.pnlPercent >= 0 ? "+" : ""}${overview.pnlPercent.toFixed(2)}%`,
      },
      {
        label: "Realized P&L",
        value: formatMoney(normalizedRealizedPnlValue),
        tone:
          normalizedRealizedPnlValue === 0
            ? "neutral"
            : normalizedRealizedPnlValue > 0
              ? "positive"
              : "negative",
      },
      {
        label: "Unrealized P&L",
        value: formatMoney(normalizedUnrealizedPnlValue),
        tone:
          normalizedUnrealizedPnlValue === 0
            ? "neutral"
            : normalizedUnrealizedPnlValue > 0
              ? "positive"
              : "negative",
      },
      {
        label: "Active Positions",
        value: detailPositionsCount === null ? "..." : detailPositionsCount.toString(),
        tone: "neutral",
      },
      {
        label: "Fees (30d)",
        value: detailFeesMonth === null ? "..." : formatMoney(detailFeesMonth),
        tone: "neutral",
      },
      {
        label: "Avg Net Edge",
        value: detailAvgNetEdge === null ? "..." : `${detailAvgNetEdge.toFixed(1)} bps`,
        tone: detailAvgNetEdge === null ? "neutral" : detailAvgNetEdge >= 0 ? "positive" : "negative",
      },
    ];
  }, [details, overview]);

  const filteredPositions = useMemo(() => {
    if (!details) return [];
    const query = positionSearch.trim().toLowerCase();
    if (!query) return details.positions;
    return details.positions.filter((position) =>
      [position.symbol, position.strategy].some((value) => value.toLowerCase().includes(query)),
    );
  }, [details, positionSearch]);

  const botHealth = details?.botHealth ?? null;
  const strategyHealth = details?.strategyHealth ?? [];

  useEffect(() => {
    setVisiblePositionsCount(PAGE_SIZE);
  }, [positionSearch, details]);

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
      {rejectionsError ? (
        <section className="oz-panel border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {rejectionsError}
        </section>
      ) : null}
      <section className="flex items-center justify-end">
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-60"
          onClick={() =>
            void (async () => {
              const ok = await loadDashboard(true);
              if (!ok) return;
              await loadRejections(true);
            })()
          }
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
                  className={`mt-1 text-lg font-semibold ${toneClass(
                    card.tone === "positive" ? "positive" : card.tone === "negative" ? "negative" : "neutral",
                  )}`}
                >
                  {card.value}
                </p>
                {card.detail ? <p className="text-xs text-muted">{card.detail}</p> : null}
              </article>
            ))}
          </section>

          {botHealth ? (
            <section className="oz-panel space-y-3 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Bot Health</h2>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(
                        healthTone(botHealth.overallStatus),
                      )}`}
                    >
                      {formatStageLabel(botHealth.overallStatus)}
                    </span>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {botHealth.mode}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{botHealth.quietReason}</p>
                </div>
                <div className="text-xs text-muted sm:text-right">
                  <div>Last trade {formatTimestamp(botHealth.lastSuccessfulTradeAt)}</div>
                  <div>Market data {formatTimestamp(botHealth.marketData.lastAt)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Pipeline", formatStageLabel(botHealth.pipelineStatus), healthTone(botHealth.pipelineStatus)],
                  [
                    "Reconciliation",
                    botHealth.reconciliation.mismatchCount === 0
                      ? "Aligned"
                      : `${botHealth.reconciliation.mismatchCount} mismatch${botHealth.reconciliation.mismatchCount === 1 ? "" : "es"}`,
                    healthTone(botHealth.reconciliation.status),
                  ],
                  ["Critical findings", botHealth.criticalDiagnosticsCount.toString(), botHealth.criticalDiagnosticsCount > 0 ? "negative" : "neutral"],
                  ["Active strategies", botHealth.activeStrategies.toString(), "neutral"],
                  ["Open positions", botHealth.activePositions.toString(), "neutral"],
                  [
                    "Market freshness",
                    botHealth.marketData.ageSeconds == null ? "Unknown" : `${Math.round(botHealth.marketData.ageSeconds)}s old`,
                    healthTone(botHealth.marketData.status),
                  ],
                ].map(([label, value, tone]) => (
                  <article key={label} className="rounded-xl border border-border/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
                    <p className={`mt-1 text-sm font-semibold ${toneClass(tone as "positive" | "negative" | "warning" | "neutral")}`}>
                      {value}
                    </p>
                  </article>
                ))}
              </div>

              {botHealth.reconciliation.topMismatchTypes.length > 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <p className="font-semibold uppercase tracking-wide">Top reconciliation mismatches</p>
                  <p className="mt-1">
                    {botHealth.reconciliation.topMismatchTypes
                      .map((item) => `${formatReasonLabel(item.type)} (${item.count})`)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-border/70 px-3 py-3 text-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-muted">Paper vs live</p>
                    <p className="mt-1 text-sm text-foreground">
                      {botHealth.paperLive.canSwitchToLive
                        ? "This account currently passes the live readiness gate."
                        : botHealth.paperLive.liveReadinessReason ?? "Live readiness still has blockers."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(
                      botHealth.paperLive.canSwitchToLive ? "positive" : "warning",
                    )}`}
                  >
                    {botHealth.paperLive.canSwitchToLive ? "live ready" : "paper only"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted">{botHealth.paperLive.paperWarning}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {botHealth.paperLive.checklist.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-wide ${
                          item.passed ? "text-positive" : "text-amber-200"
                        }`}
                      >
                        {item.passed ? "ready" : "needs work"} · {item.label}
                      </p>
                      <p className="mt-1 text-muted">{item.detail ?? "No detail available."}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {details?.capitalUtilization?.byStrategy ? (
            <section className="oz-panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Capital utilization</h2>
                  <p className="text-xs text-muted">
                    {formatMoney(details.capitalUtilization.deployedCapital)} deployed of{" "}
                    {formatMoney(details.capitalUtilization.totalCapital)} (
                    {details.capitalUtilization.totalDeployedPct.toFixed(1)}%)
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>Reserved {formatMoney(details.capitalUtilization.reservedCash)}</div>
                  <div>Locked {formatMoney(details.capitalUtilization.lockedCapital)}</div>
                </div>
              </div>
              <div className="space-y-2">
                {details.capitalUtilization.byStrategy.map((row) => {
                  const avgTradeSize = details.capitalUtilization.avgTradeSizeByStrategy.find(
                    (item) => item.strategy === row.strategy,
                  )?.avgTradeSize;
                  return (
                    <div
                      key={row.strategy}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="font-medium text-foreground">{row.strategy}</div>
                        <div className="text-muted">
                          Assigned {formatMoney(row.assignedCapital)} · Deployed {formatMoney(row.deployedCapital)}
                        </div>
                      </div>
                      <div className="text-right text-muted">
                        <div>{row.utilizationPct.toFixed(1)}% utilized</div>
                        <div>Avg trade {formatMoney(avgTradeSize ?? 0)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <GrowthChart values={overview.growth} positive={overview.pnlValue >= 0} />

          {!rejections ? (
            rejectionsError ? null : <RowSkeleton />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Trade Blockers ({rejections.windowHours}h)
                </h2>
                <div className="flex flex-wrap gap-2">
                  {REJECTION_WINDOWS.map((windowHours) => (
                    <button
                      key={windowHours}
                      type="button"
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        rejectionWindowHours === windowHours
                          ? "border-foreground text-foreground"
                          : "border-border text-muted"
                      }`}
                      onClick={() => setRejectionWindowHours(windowHours)}
                    >
                      {windowHours}h
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <article className="oz-panel p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Recent Rejections</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {rejections.rejectionDiagnostics.totalRejected}
                  </p>
                </article>
                <article className="oz-panel p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Skipped For Fees</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{rejections.skippedTradesDueToFees}</p>
                </article>
                {rejections.rejectionDiagnostics.byStage.slice(0, 2).map((row) => (
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
                    {rejections.rejectionDiagnostics.breakdown.length === 0 ? (
                      <p className="text-sm text-muted">No persisted rejection reasons in this window.</p>
                    ) : (
                      rejections.rejectionDiagnostics.breakdown.map((row) => (
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted">Latest Rejections</p>
                    {rejections.budget.capped ? (
                      <span className="text-[10px] uppercase tracking-wide text-muted">
                        Showing latest {rejections.budget.eventLimit}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-2">
                    {rejections.rejectionDiagnostics.recent.length === 0 ? (
                      <p className="text-sm text-muted">No recent persisted rejection events in this mode.</p>
                    ) : (
                      rejections.rejectionDiagnostics.recent.map((row, index) => (
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
          )}

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
                    [
                      "Skipped For Fees",
                      (rejections?.skippedTradesDueToFees ?? details.feeAnalytics.skippedTradesDueToFees).toString(),
                    ],
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
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Strategy Health</h2>
                  <p className="text-xs text-muted">
                    Why each strategy is trading, waiting, blocked, or just monitoring.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {strategyHealth.map((item) => {
                    const pnl = normalizeDisplayValue(item.realizedPnl + item.unrealizedPnl);
                    const dcaTiming =
                      item.id === "dca"
                        ? [
                            item.lastBuyAt ? `Last buy ${formatTimestamp(item.lastBuyAt)}` : null,
                            formatIntervalHours(item.dcaIntervalHours)
                              ? `Interval ${formatIntervalHours(item.dcaIntervalHours)}`
                              : null,
                            item.nextEligibleAt ? `Next eligible ${formatTimestamp(item.nextEligibleAt)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : null;
                    return (
                      <article key={item.id} className="oz-panel space-y-3 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="text-xs text-muted">
                              Allocation {item.allocationPct}% · Deployed {formatMoney(item.deployedCapital)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(
                                item.enabled ? "positive" : "neutral",
                              )}`}
                            >
                              {item.enabled ? "enabled" : "disabled"}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(
                                healthTone(item.currentStatus),
                              )}`}
                            >
                              {formatStageLabel(item.currentStatus)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                          <div>Last eval {formatTimestamp(item.lastEvaluatedAt)}</div>
                          <div className="text-right">Last signal {formatTimestamp(item.lastSignalAt)}</div>
                          <div>
                            Last action {item.lastSignalAction ? formatStageLabel(item.lastSignalAction) : "—"}
                          </div>
                          <div className="text-right">
                            {item.id === "dca" ? "Last buy" : "Last trade"}{" "}
                            {formatTimestamp(item.id === "dca" ? item.lastBuyAt : item.lastTradeAt)}
                          </div>
                          <div>Open positions {item.openPositions}</div>
                          <div className="text-right">Utilization {item.utilizationPct.toFixed(1)}%</div>
                        </div>

                        <div className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                          <p className="uppercase tracking-wide text-muted">Current blocker / reason</p>
                          <p className="mt-1 text-sm text-foreground">
                            {item.blockingReasonDetail ??
                              item.lastSignalReason ??
                              (item.currentStatus === "managing_position"
                                ? "Managing an open position."
                                : item.currentStatus === "ready"
                                  ? "Evaluating normally."
                                  : item.currentStatus === "inactive"
                                    ? "No recent evaluation recorded."
                                    : "No blocking reason recorded.")}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {[
                              item.blockingReasonCode ? formatReasonLabel(item.blockingReasonCode) : null,
                              dcaTiming ?? (item.nextEligibleAt ? `Next eligible ${formatTimestamp(item.nextEligibleAt)}` : null),
                              item.exitMonitoredPositions > 0
                                ? `Exit watch ${item.exitMonitoredPositions}`
                                : null,
                              item.stalledExitCount > 0
                                ? `Stalled exits ${item.stalledExitCount}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">
                            Capital {formatMoney(item.assignedCapital)} · Cash {formatMoney(item.availableCash)}
                          </span>
                          <span className={toneClass(pnl > 0 ? "positive" : pnl < 0 ? "negative" : "neutral")}>
                            P&L {formatMoney(pnl)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Active Positions</h2>
                <div className="space-y-3">
                  <p className="text-xs text-muted">
                    Opened = first entry for this position. Last Activity = most recent position update.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <input
                      type="search"
                      value={positionSearch}
                      onChange={(event) => setPositionSearch(event.target.value)}
                      placeholder="Search positions by symbol or strategy"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted sm:max-w-sm"
                    />
                    <p className="text-xs text-muted">
                      Showing {Math.min(visiblePositionsCount, filteredPositions.length)} of {filteredPositions.length}
                    </p>
                  </div>
                  {details.positions.length === 0 ? (
                    <article className="oz-panel p-3 text-sm text-muted">
                      No active positions above the dashboard dust threshold right now.
                    </article>
                  ) : filteredPositions.length === 0 ? (
                    <article className="oz-panel p-3 text-sm text-muted">
                      No active positions match that search.
                    </article>
                  ) : (
                    <>
                      {filteredPositions.slice(0, visiblePositionsCount).map((position) => {
                        const normalizedUnrealizedPnl = normalizeDisplayValue(position.unrealizedPnl);
                        return (
                          <article key={position.id} className="oz-panel p-3">
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-sm font-semibold">{position.symbol}</p>
                              <span className="text-xs text-muted">{position.strategy}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                              <span>Qty {position.quantity}</span>
                              <span className="text-right">{formatMoney(position.exposure)}</span>
                              <span>Entry {formatMoney(position.entryPrice)}</span>
                              <span className="text-right">Mark {formatMoney(position.markPrice)}</span>
                              <span>Opened {formatTimestamp(position.openedAt)}</span>
                              <span className="text-right">Last Activity {formatTimestamp(position.lastTradeAt)}</span>
                              <span>Open Age {formatPositionAge(position.ageHours)}</span>
                              <span className="text-right">{position.side.toUpperCase()}</span>
                            </div>
                            {position.exitStatus ? (
                              <div className="mt-2 rounded-lg border border-border/70 px-3 py-2 text-xs">
                                <p className="uppercase tracking-wide text-muted">Exit state</p>
                                <p className="mt-1 text-sm text-foreground">
                                  {formatExitStatus(position.exitStatus)}
                                  {position.exitReasonDetail ? ` · ${position.exitReasonDetail}` : ""}
                                </p>
                                <p className="mt-1 text-[11px] text-muted">
                                  {[
                                    position.exitStage ? formatStageLabel(position.exitStage) : null,
                                    position.exitUpdatedAt
                                      ? `Updated ${formatTimestamp(position.exitUpdatedAt)}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                            ) : null}
                            <p
                              className={`mt-2 text-sm font-semibold ${
                                normalizedUnrealizedPnl === 0
                                  ? "text-muted"
                                  : normalizedUnrealizedPnl > 0
                                    ? "text-positive"
                                    : "text-negative"
                              }`}
                            >
                              Unrealized {formatMoney(normalizedUnrealizedPnl)}
                            </p>
                          </article>
                        );
                      })}
                      {filteredPositions.length > visiblePositionsCount ? (
                        <button
                          type="button"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted"
                          onClick={() => setVisiblePositionsCount((count) => count + PAGE_SIZE)}
                        >
                          Load 5 more positions
                        </button>
                      ) : null}
                    </>
                  )}
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
