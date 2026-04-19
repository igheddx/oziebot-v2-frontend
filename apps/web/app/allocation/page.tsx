"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
import { RowSkeleton } from "@/components/ui/skeleton";

type AllocationItem = {
  strategyId: string;
  strategyName: string;
  percent: number;
  availableCash: number;
};

type PlanState = {
  totalCapitalCents: number;
  items: AllocationItem[];
};

type CatalogStrategy = {
  strategy_id: string;
  display_name: string;
  is_assigned: boolean;
};

function formatStrategyName(id: string) {
  return id
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}

export default function AllocationPage() {
  const { mode } = useTradingMode();
  const isLiveMode = mode === "live";
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localPercents, setLocalPercents] = useState<Record<string, number>>({});
  const [totalDollars, setTotalDollars] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    const [planRes, bucketRes, catalogRes] = await Promise.all([
      authFetch(`/v1/me/allocations/${mode}`),
      authFetch(`/v1/me/allocations/${mode}/buckets`),
      authFetch("/v1/me/strategies/catalog"),
    ]);
    setIsLoading(false);

    const buckets: Array<{ strategy_id: string; available_cash_cents: number }> =
      bucketRes?.ok ? ((await bucketRes.json()) as { buckets: Array<{ strategy_id: string; available_cash_cents: number }> }).buckets : [];
    const bucketMap = new Map(buckets.map((b) => [b.strategy_id, b.available_cash_cents]));
    const catalogStrategies: CatalogStrategy[] =
      catalogRes?.ok
        ? ((await catalogRes.json()) as { strategies: CatalogStrategy[] }).strategies ?? []
        : [];
    const assigned = catalogStrategies.filter((s) => s.is_assigned);
    const nameById = new Map(
      catalogStrategies.map((s) => [s.strategy_id, s.display_name || formatStrategyName(s.strategy_id)]),
    );

    // No plan yet — bootstrap from assigned catalog strategies
    if (!planRes || planRes.status === 404) {
      if (assigned.length === 0) {
        setPlan(null);
        return;
      }
      const equalPct = Math.floor(100 / assigned.length);
      let remainder = 100 - equalPct * assigned.length;
      const items: AllocationItem[] = assigned.map((s) => {
        const pct = equalPct + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return {
        strategyId: s.strategy_id,
        strategyName: s.display_name || formatStrategyName(s.strategy_id),
        percent: pct,
        availableCash: (bucketMap.get(s.strategy_id) ?? 0) / 100,
      };
      });
      const defaultTotalCents = mode === "paper" ? 100_000 : 0;
      setPlan({ totalCapitalCents: defaultTotalCents, items });
      setTotalDollars(mode === "paper" ? "1000" : "");
      setLocalPercents(Object.fromEntries(items.map((i) => [i.strategyId, i.percent])));
      return;
    }

    if (!planRes.ok) return;

    const planData = (await planRes.json()) as {
      total_capital_cents: number;
      items: Array<{ strategy_id: string; allocation_bps: number; assigned_capital_cents: number }>;
    };

    const items: AllocationItem[] = planData.items.map((i) => ({
      strategyId: i.strategy_id,
      strategyName: nameById.get(i.strategy_id) ?? formatStrategyName(i.strategy_id),
      percent: Math.round(i.allocation_bps / 100),
      availableCash: (bucketMap.get(i.strategy_id) ?? 0) / 100,
    }));

    const existingIds = new Set(items.map((i) => i.strategyId));
    for (const s of assigned) {
      if (existingIds.has(s.strategy_id)) continue;
      items.push({
        strategyId: s.strategy_id,
        strategyName: s.display_name || formatStrategyName(s.strategy_id),
        percent: 0,
        availableCash: (bucketMap.get(s.strategy_id) ?? 0) / 100,
      });
    }

    setPlan({ totalCapitalCents: planData.total_capital_cents, items });
    setTotalDollars(
      planData.total_capital_cents > 0
        ? String(Math.round(planData.total_capital_cents / 100))
        : mode === "paper"
          ? "1000"
          : "",
    );
    setLocalPercents(Object.fromEntries(items.map((i) => [i.strategyId, i.percent])));
  }, [mode]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const totalPct = Object.values(localPercents).reduce((a, b) => a + b, 0);

  const savePlan = async () => {
    setSaving(true);
    setStatus(null);
    const totalCents = isLiveMode
      ? plan?.totalCapitalCents ?? 0
      : Math.round(parseFloat(totalDollars || "0") * 100);
    if (totalCents <= 0) {
      setStatus(
        isLiveMode
          ? "Coinbase available cash must be greater than $0 before live allocations can be saved."
          : "Total capital must be greater than $0.",
      );
      setSaving(false);
      return;
    }
    const allocations = Object.entries(localPercents).map(([strategy_id, pct]) => ({
      strategy_id,
      allocation_bps: pct * 100,
    }));
    const res = await authFetch(`/v1/me/allocations/${mode}/manual`, {
      method: "PUT",
      body: JSON.stringify({ total_capital_cents: totalCents, allocations }),
    });
    setSaving(false);
    if (!res) { setStatus("Could not reach API."); return; }
    if (!res.ok) { setStatus(await parseErrorMessage(res)); return; }
    setStatus("Saved.");
    loadPlan();
  };

  if (isLoading) {
    return (
      <AppShell title="Strategy Allocation" subtitle="Compact thumb sliders and quick edits for portfolio split.">
        {Array.from({ length: 4 }).map((_, idx) => <RowSkeleton key={`sk-${idx}`} />)}
      </AppShell>
    );
  }

  if (!plan) {
    return (
      <AppShell title="Strategy Allocation" subtitle="Compact thumb sliders and quick edits for portfolio split.">
        <section className="oz-panel p-4 text-sm text-muted">
          No strategies enabled yet for <span className="font-semibold uppercase">{mode}</span> mode. Enable strategies
          first, then return here to allocate capital.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Strategy Allocation" subtitle="Compact thumb sliders and quick edits for portfolio split.">
      <section className="oz-panel space-y-3 p-3">
         <div className="flex items-center justify-between">
           <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Capital ({mode.toUpperCase()})</p>
           <div className="flex items-center gap-1">
             <span className="text-sm text-muted">$</span>
             <input
               type="number"
               min={0}
               readOnly={isLiveMode}
               className="h-8 w-28 rounded-lg border border-border bg-card px-2 text-right text-sm outline-none focus:border-sky-400 read-only:text-muted read-only:opacity-80"
               value={totalDollars}
               onChange={(e) => setTotalDollars(e.target.value)}
             />
           </div>
         </div>
         <p className="text-xs text-muted">
           {isLiveMode
             ? "Live capital auto-syncs from your Coinbase available USD/USDC/USDT cash. Only paper mode uses manual total capital."
             : "Paper mode uses your manually entered total capital."}
         </p>

        {plan.items.map((item) => (
          <article key={item.strategyId}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold">{item.strategyName}</p>
              <p className="text-sm font-semibold text-foreground">{localPercents[item.strategyId] ?? item.percent}%</p>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={localPercents[item.strategyId] ?? item.percent}
              onChange={(e) =>
                setLocalPercents((prev) => ({ ...prev, [item.strategyId]: Number(e.target.value) }))
              }
              className="h-8 w-full accent-sky-400"
            />
            <p className="text-xs text-muted">Available cash ${item.availableCash.toLocaleString()}</p>
          </article>
        ))}

        {totalPct !== 100 && (
          <p className="text-xs text-amber-400">Allocations sum to {totalPct}% — should equal 100%.</p>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={savePlan}
          className="h-10 w-full rounded-lg bg-sky-500 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Allocation"}
        </button>
        {status ? <p className="text-xs text-muted">{status}</p> : null}
      </section>
    </AppShell>
  );
}
