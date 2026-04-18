"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { TradeCardsHybrid } from "@/components/dashboard/trade-cards-hybrid";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { getDashboardSummary } from "@/lib/dashboard-api";
import type { DashboardSummary } from "@/lib/dashboard-types";
import { CardSkeleton, RowSkeleton, Skeleton } from "@/components/ui/skeleton";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function DashboardScreen() {
  const { mode } = useTradingMode();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    getDashboardSummary(mode).then((data) => {
      if (mounted) setSummary(data);
    });
    return () => {
      mounted = false;
    };
  }, [mode]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Available Balance", value: formatMoney(summary.availableBalance), tone: "neutral" },
      { label: "Portfolio", value: formatMoney(summary.portfolioValue), tone: "neutral" },
      {
        label: summary.gainLossLabel,
        value: formatMoney(summary.pnlValue),
        tone: summary.pnlValue >= 0 ? "positive" : "negative",
        detail: `${summary.pnlPercent >= 0 ? "+" : ""}${summary.pnlPercent.toFixed(2)}%`,
      },
      { label: "Active Positions", value: summary.positions.length.toString(), tone: "neutral" },
    ];
  }, [summary]);

  return (
    <AppShell title="Dashboard" subtitle="Portfolio, positions, and trades filtered by current mode.">
      {!summary ? (
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

          <GrowthChart values={summary.growth} positive={summary.pnlValue >= 0} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Enabled Strategies</h2>
            <div className="space-y-2">
              {summary.enabledStrategies
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
              {summary.positions.map((position) => (
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
                  <p className={`mt-2 text-sm font-semibold ${position.unrealizedPnl >= 0 ? "text-positive" : "text-negative"}`}>
                    Unrealized {formatMoney(position.unrealizedPnl)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <TradeCardsHybrid activeTrades={summary.activeTrades} recent={summary.recentActivity} />
        </>
      )}
    </AppShell>
  );
}
