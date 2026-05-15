"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
import { RowSkeleton } from "@/components/ui/skeleton";

type BucketConfig = {
  id: string;
  label: string;
  allocation_pct: number;
  max_positions: number;
  max_allocation_per_token_pct: number;
  stop_loss_pct: number;
  profit_targets_pct: number[];
  trailing_stop_activation_pct: number;
  trailing_stop_pct: number;
  selected_tokens: string[];
  prefer_base_ecosystem: boolean;
};

type StrategyConfig = {
  trading_mode: "paper" | "live";
  enabled: boolean;
  total_allocated_amount_usd: { target?: number; source?: string };
  bucket_allocations: BucketConfig[];
  selected_tokens: Record<string, string[]>;
  max_allocation_per_token: Record<string, number>;
  profit_taking_rules: {
    scale_out_fraction_pct?: number;
    cost_basis_recovery_enabled?: boolean;
    cost_basis_recovery_trigger_pct?: number;
  };
  stop_loss_rules: Record<string, number>;
  trailing_stop_rules: Record<string, { activation_pct?: number; trailing_pct?: number }>;
  rebalance_settings: {
    mode?: string;
    drift_threshold_pct?: number;
    aggressive_rebalance?: boolean;
    cadence?: string;
  };
  mode_settings: {
    evaluation_interval_minutes?: number;
    minimum_order_size_usd?: number;
    max_total_open_positions?: number;
  };
};

type TokenOption = {
  symbol: string;
  display_name: string | null;
  ecosystem: string | null;
  strategy_policy_status: string;
};

type PositionRow = {
  id: string;
  symbol: string;
  quantity: string;
  entry_price: string;
  mark_price: string;
  exposure_usd: number;
  unrealized_pnl_usd: number;
};

type PerformanceResponse = {
  realized_pnl_cents: number;
  unrealized_pnl_cents: number;
  total_pnl_cents: number;
  trade_count: number;
  open_position_count: number;
};

type ProfitEvent = {
  id: string;
  symbol: string;
  bucket_id: string;
  event_type: string;
  status: string;
  quantity: string;
  occurred_at: string;
};

type PreviewAction = {
  symbol: string;
  action: string;
  bucket_id: string;
  reason: string;
  suggested_size_usd: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function StrategicAllocationPage() {
  const { mode } = useTradingMode();
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [profitEvents, setProfitEvents] = useState<ProfitEvent[]>([]);
  const [previewActions, setPreviewActions] = useState<PreviewAction[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const loadScreen = useCallback(async () => {
    setIsLoading(true);
    const [configRes, positionsRes, performanceRes, historyRes] = await Promise.all([
      authFetch(`/v1/me/strategies/strategic-aggressive-allocation/config?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/strategic-aggressive-allocation/positions?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/strategic-aggressive-allocation/performance?trading_mode=${mode}`),
      authFetch(
        `/v1/me/strategies/strategic-aggressive-allocation/profit-taking-history?trading_mode=${mode}`,
      ),
    ]);
    setIsLoading(false);

    if (!configRes || !configRes.ok) {
      setStatus(configRes ? await parseErrorMessage(configRes) : "Could not reach API.");
      return;
    }

    const configData = (await configRes.json()) as {
      config: StrategyConfig;
      available_tokens: TokenOption[];
    };
    setConfig(configData.config);
    setAvailableTokens(configData.available_tokens ?? []);

    if (positionsRes?.ok) {
      const positionsData = (await positionsRes.json()) as { positions: PositionRow[] };
      setPositions(positionsData.positions ?? []);
    } else {
      setPositions([]);
    }

    if (performanceRes?.ok) {
      setPerformance((await performanceRes.json()) as PerformanceResponse);
    } else {
      setPerformance(null);
    }

    if (historyRes?.ok) {
      setProfitEvents((await historyRes.json()) as ProfitEvent[]);
    } else {
      setProfitEvents([]);
    }
  }, [mode]);

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  const bucketTotal = useMemo(
    () => config?.bucket_allocations.reduce((sum, bucket) => sum + Number(bucket.allocation_pct || 0), 0) ?? 0,
    [config],
  );

  const updateBucket = (bucketId: string, updater: (bucket: BucketConfig) => BucketConfig) => {
    setConfig((current) => {
      if (!current) return current;
      const bucketAllocations = current.bucket_allocations.map((bucket) =>
        bucket.id === bucketId ? updater(bucket) : bucket,
      );
      const selectedTokens = Object.fromEntries(
        bucketAllocations.map((bucket) => [bucket.id, bucket.selected_tokens ?? []]),
      );
      return { ...current, bucket_allocations: bucketAllocations, selected_tokens: selectedTokens };
    });
  };

  const saveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    setStatus(null);
    const res = await authFetch("/v1/me/strategies/strategic-aggressive-allocation/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
    setIsSaving(false);
    if (!res) {
      setStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setStatus(await parseErrorMessage(res));
      return;
    }
    setStatus("Configuration saved.");
    await loadScreen();
  };

  const toggleEnabled = async (enabled: boolean) => {
    const endpoint = enabled ? "enable" : "disable";
    const res = await authFetch(`/v1/me/strategies/strategic-aggressive-allocation/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({ trading_mode: mode }),
    });
    if (!res || !res.ok) {
      setStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setStatus(enabled ? "Strategy enabled." : "Strategy disabled.");
    await loadScreen();
  };

  const runPreview = async (execute: boolean) => {
    const setter = execute ? setIsExecuting : setIsPreviewing;
    setter(true);
    const endpoint = execute ? "rebalance-execute" : "rebalance-preview";
    const res = await authFetch(`/v1/me/strategies/strategic-aggressive-allocation/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({ trading_mode: mode, execute }),
    });
    setter(false);
    if (!res) {
      setStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setStatus(await parseErrorMessage(res));
      return;
    }
    const data = (await res.json()) as { actions?: PreviewAction[]; queued?: PreviewAction[] };
    setPreviewActions(data.actions ?? data.queued ?? []);
    setStatus(execute ? "Rebalance orders queued." : "Rebalance preview refreshed.");
    if (execute) await loadScreen();
  };

  if (isLoading || !config) {
    return (
      <AppShell
        title="Strategic Allocation"
        subtitle="Aggressive multi-bucket portfolio configuration for paper or live trading."
      >
        {Array.from({ length: 6 }).map((_, idx) => (
          <RowSkeleton key={`saa-sk-${idx}`} />
        ))}
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Strategic Allocation"
      subtitle={`Independent aggressive strategy configuration for ${mode.toUpperCase()} mode.`}
    >
      {mode === "live" ? (
        <section className="oz-panel border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          This is an aggressive strategy. Crypto is volatile and losses are possible.
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <article className="oz-panel space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mode</p>
              <p className="text-lg font-semibold">{mode.toUpperCase()}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void toggleEnabled(true)}
                className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={() => void toggleEnabled(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
              >
                Disable
              </button>
            </div>
          </div>
          <p className="text-sm text-muted">
            Status: <span className="font-semibold text-foreground">{config.enabled ? "Enabled" : "Disabled"}</span>
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Target capital</span>
            <input
              type="number"
              min={0}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              value={String(config.total_allocated_amount_usd?.target ?? 0)}
              onChange={(event) =>
                setConfig((current) =>
                  current
                    ? {
                        ...current,
                        total_allocated_amount_usd: {
                          ...(current.total_allocated_amount_usd ?? {}),
                          target: Number(event.target.value || 0),
                        },
                      }
                    : current,
                )
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Eval interval (min)</span>
              <input
                type="number"
                min={15}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                value={String(config.mode_settings?.evaluation_interval_minutes ?? 60)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          mode_settings: {
                            ...(current.mode_settings ?? {}),
                            evaluation_interval_minutes: Number(event.target.value || 60),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Minimum order USD</span>
              <input
                type="number"
                min={1}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                value={String(config.mode_settings?.minimum_order_size_usd ?? 25)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          mode_settings: {
                            ...(current.mode_settings ?? {}),
                            minimum_order_size_usd: Number(event.target.value || 25),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Rebalance mode</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={config.rebalance_settings?.mode ?? "manual"}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          rebalance_settings: {
                            ...(current.rebalance_settings ?? {}),
                            mode: event.target.value,
                          },
                        }
                      : current,
                  )
                }
              >
                <option value="manual">Manual / Off</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Drift threshold %</span>
              <input
                type="number"
                min={0}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                value={String(config.rebalance_settings?.drift_threshold_pct ?? 10)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          rebalance_settings: {
                            ...(current.rebalance_settings ?? {}),
                            drift_threshold_pct: Number(event.target.value || 0),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={Boolean(config.rebalance_settings?.aggressive_rebalance)}
              onChange={(event) =>
                setConfig((current) =>
                  current
                    ? {
                        ...current,
                        rebalance_settings: {
                          ...(current.rebalance_settings ?? {}),
                          aggressive_rebalance: event.target.checked,
                        },
                      }
                    : current,
                )
              }
            />
            Allow aggressive rebalance rotation
          </label>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void saveConfig()}
            className="h-10 w-full rounded-lg bg-sky-500 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save strategy configuration"}
          </button>
          <Link href="/trading-performance-export" className="text-xs font-semibold text-sky-300 underline">
            Export trades
          </Link>
        </article>

        <article className="oz-panel space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Performance</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Realized P&amp;L</p>
              <p className="mt-1 font-semibold">{formatMoney((performance?.realized_pnl_cents ?? 0) / 100)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Unrealized P&amp;L</p>
              <p className="mt-1 font-semibold">{formatMoney((performance?.unrealized_pnl_cents ?? 0) / 100)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Open positions</p>
              <p className="mt-1 font-semibold">{performance?.open_position_count ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Trades</p>
              <p className="mt-1 font-semibold">{performance?.trade_count ?? 0}</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            Bucket total: {bucketTotal.toFixed(2)}% {bucketTotal === 100 ? "✓" : "(must equal 100%)"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={isPreviewing}
              onClick={() => void runPreview(false)}
              className="h-10 rounded-lg border border-border text-sm font-semibold text-foreground disabled:opacity-50"
            >
              {isPreviewing ? "Previewing..." : "Preview rebalance"}
            </button>
            <button
              type="button"
              disabled={isExecuting}
              onClick={() => void runPreview(true)}
              className="h-10 rounded-lg bg-emerald-500 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isExecuting ? "Queueing..." : "Execute rebalance"}
            </button>
          </div>
          {status ? <p className="text-xs text-muted">{status}</p> : null}
          {previewActions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Latest preview / queue</p>
              {previewActions.map((action, idx) => (
                <div key={`${action.symbol}-${idx}`} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold">
                    {action.action.toUpperCase()} {action.symbol}
                  </p>
                  <p className="text-xs text-muted">
                    {action.bucket_id} · {action.reason} · {formatMoney(action.suggested_size_usd ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid gap-3">
        {config.bucket_allocations.map((bucket) => (
          <article key={bucket.id} className="oz-panel space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{bucket.label}</p>
                <p className="text-xs text-muted">{bucket.id === "dry_powder" ? "Reserved cash only" : "Tradable bucket"}</p>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-right text-sm outline-none focus:border-sky-400"
                value={String(bucket.allocation_pct)}
                onChange={(event) =>
                  updateBucket(bucket.id, (current) => ({
                    ...current,
                    allocation_pct: Number(event.target.value || 0),
                  }))
                }
              />
            </div>
            {bucket.id !== "dry_powder" ? (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Max positions</span>
                    <input
                      type="number"
                      min={1}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                      value={String(bucket.max_positions)}
                      onChange={(event) =>
                        updateBucket(bucket.id, (current) => ({
                          ...current,
                          max_positions: Number(event.target.value || 1),
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Max token %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                      value={String(bucket.max_allocation_per_token_pct)}
                      onChange={(event) =>
                        updateBucket(bucket.id, (current) => ({
                          ...current,
                          max_allocation_per_token_pct: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Stop loss %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                      value={String(bucket.stop_loss_pct)}
                      onChange={(event) =>
                        updateBucket(bucket.id, (current) => ({
                          ...current,
                          stop_loss_pct: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Selected tokens (admin-approved only)
                  </span>
                  <select
                    multiple
                    className="min-h-32 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    value={bucket.selected_tokens ?? []}
                    onChange={(event) =>
                      updateBucket(bucket.id, (current) => ({
                        ...current,
                        selected_tokens: Array.from(event.target.selectedOptions).map((option) => option.value),
                      }))
                    }
                  >
                    {availableTokens.map((token) => (
                      <option key={`${bucket.id}-${token.symbol}`} value={token.symbol}>
                        {token.symbol} {token.ecosystem ? `· ${token.ecosystem}` : ""} · {token.strategy_policy_status}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="text-sm text-muted">Dry powder stays in cash and is never traded.</p>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="oz-panel space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Open positions</p>
          {positions.length === 0 ? (
            <p className="text-sm text-muted">No open positions for this strategy in {mode.toUpperCase()} mode.</p>
          ) : (
            positions.map((position) => (
              <div key={position.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{position.symbol}</p>
                  <p>{position.quantity}</p>
                </div>
                <p className="text-xs text-muted">
                  Entry {position.entry_price} · Mark {position.mark_price} · Exposure {formatMoney(position.exposure_usd)}
                </p>
                <p className="text-xs text-muted">Unrealized {formatMoney(position.unrealized_pnl_usd)}</p>
              </div>
            ))
          )}
        </article>

        <article className="oz-panel space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Profit-taking events</p>
          {profitEvents.length === 0 ? (
            <p className="text-sm text-muted">No scale-out or recovery events recorded yet.</p>
          ) : (
            profitEvents.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{event.symbol}</p>
                  <p className="text-xs text-muted">{new Date(event.occurred_at).toLocaleString()}</p>
                </div>
                <p className="text-xs text-muted">
                  {event.event_type} · {event.status} · qty {event.quantity} · bucket {event.bucket_id}
                </p>
              </div>
            ))
          )}
        </article>
      </section>
    </AppShell>
  );
}
