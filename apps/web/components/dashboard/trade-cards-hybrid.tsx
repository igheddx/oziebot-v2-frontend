"use client";

import { useEffect, useMemo, useState } from "react";

import type { DashboardSummary } from "@/lib/dashboard-types";

type TradeCardsHybridProps = {
  activeTrades: DashboardSummary["activeTrades"];
  recent: DashboardSummary["recentActivity"];
};

const PAGE_SIZE = 5;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Math.abs(value) < 0.005 ? 0 : value,
  );
}

export function TradeCardsHybrid({ activeTrades, recent }: TradeCardsHybridProps) {
  const [recentSearch, setRecentSearch] = useState("");
  const [visibleRecentCount, setVisibleRecentCount] = useState(PAGE_SIZE);

  const filteredRecent = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();
    if (!query) return recent;
    return recent.filter((item) =>
      [item.symbol, item.side, item.status, item.timestamp, item.amount].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [recent, recentSearch]);

  useEffect(() => {
    setVisibleRecentCount(PAGE_SIZE);
  }, [recent, recentSearch]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Trades In Progress</h2>
      <p className="text-xs text-muted">
        Shows orders that are still pending, open, or partially filled. Filled orders move to Recent Activity, so this
        section is often empty when execution is fast.
      </p>
      <div className="space-y-2">
        {activeTrades.length === 0 ? (
          <div className="oz-panel p-3 text-sm text-muted">No orders are currently in flight.</div>
        ) : (
          activeTrades.map((trade) => (
            <article key={trade.id} className="oz-panel p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{trade.symbol}</p>
                  <p className="text-xs text-muted">{trade.strategy}</p>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase text-muted">
                  {trade.status.replace("_", " ")}
                </span>
              </div>
              <div className="mb-2 h-2 rounded-full bg-surface">
                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${trade.progressPct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-1 text-[11px] text-muted">
                <span>{trade.progressPct}%</span>
                <span className="text-center">${trade.notional.toLocaleString()}</span>
                <span className="text-right">{trade.submittedAt}</span>
              </div>
            </article>
          ))
        )}
      </div>

      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted">Recent Activity</h2>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={recentSearch}
            onChange={(event) => setRecentSearch(event.target.value)}
            placeholder="Search recent activity by symbol, side, status, or amount"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted sm:max-w-sm"
          />
          <p className="text-xs text-muted">
            Showing {Math.min(visibleRecentCount, filteredRecent.length)} of {filteredRecent.length}
          </p>
        </div>
        <div className="oz-panel overflow-hidden">
          {filteredRecent.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted">No recent activity matches that search.</div>
          ) : (
            filteredRecent.slice(0, visibleRecentCount).map((item, idx) => (
              <div
                key={item.id}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 ${
                  idx < Math.min(visibleRecentCount, filteredRecent.length) - 1 ? "border-b border-border/60" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.symbol} <span className="text-xs uppercase text-muted">{item.side}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {item.amount} @ {formatMoney(item.price)} · {item.timestamp}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                    item.status === "filled"
                      ? "bg-positive/20 text-positive"
                      : item.status === "failed"
                        ? "bg-negative/20 text-negative"
                        : "bg-surface text-muted"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>
        {filteredRecent.length > visibleRecentCount ? (
          <button
            type="button"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted"
            onClick={() => setVisibleRecentCount((count) => count + PAGE_SIZE)}
          >
            Load 5 more activity rows
          </button>
        ) : null}
      </div>
    </section>
  );
}
