import type { DashboardSummary } from "@/lib/dashboard-types";

type TradeCardsHybridProps = {
  activeTrades: DashboardSummary["activeTrades"];
  recent: DashboardSummary["recentActivity"];
};

export function TradeCardsHybrid({ activeTrades, recent }: TradeCardsHybridProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Trades In Progress</h2>
      <div className="space-y-2">
        {activeTrades.map((trade) => (
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
        ))}
      </div>

      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted">Recent Activity</h2>
      <div className="oz-panel overflow-hidden">
        {recent.map((item, idx) => (
          <div
            key={item.id}
            className={`grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 ${
              idx < recent.length - 1 ? "border-b border-border/60" : ""
            }`}
          >
            <div>
              <p className="text-sm font-medium">
                {item.symbol} <span className="text-xs uppercase text-muted">{item.side}</span>
              </p>
              <p className="text-xs text-muted">
                {item.amount} @ ${item.price.toLocaleString()} · {item.timestamp}
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
        ))}
      </div>
    </section>
  );
}
