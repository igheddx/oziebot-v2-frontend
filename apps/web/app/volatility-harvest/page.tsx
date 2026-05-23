"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { RowSkeleton } from "@/components/ui/skeleton";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";

type StrategyConfig = {
  trading_mode: "paper" | "live";
  enabled: boolean;
  selected_tokens: string[];
  total_allocated_amount_usd: { target?: number; source?: string };
  core_position_percentage: number;
  trading_position_percentage: number;
  entry_layers: Array<{ id: string; allocation_pct: number; pullback_pct: number }>;
  harvest_bands: Array<{ id: string; trigger_pct: number; sell_pct: number }>;
  rebuy_bands: Array<{ id: string; trigger_pct: number; deploy_cash_pct: number }>;
  volatility_settings: Record<string, number | boolean>;
  risk_controls: Record<string, number | boolean>;
  fee_settings: Record<string, number>;
  mode_settings: Record<string, number>;
};

type TokenOption = {
  symbol: string;
  display_name: string | null;
  ecosystem: string | null;
  strategy_policy_status: string;
  volatility_score: number | null;
  liquidity_score: number | null;
};

type Overview = {
  enabled: boolean;
  harvested_cash_cents: number;
  lifetime_harvested_gains_cents: number;
  realized_gains_cents: number;
  unrealized_gains_cents: number;
  token_accumulation_quantity: string;
  token_accumulation_pct: string;
  avg_rebuy_efficiency_pct: string;
};

type PositionRow = {
  symbol: string;
  core_quantity: string;
  trading_quantity: string;
  avg_core_entry_price: string;
  avg_trading_entry_price: string;
  harvested_cash_cents: number;
  realized_gains_cents: number;
  unrealized_gains_cents: number;
  token_accumulation_quantity: string;
  token_accumulation_pct: string;
};

type TransactionRow = {
  id: string;
  symbol: string;
  transaction_type: string;
  band_code: string | null;
  quantity: string;
  price: string;
  net_profit_cents: number;
  occurred_at: string;
};

type AdminDefaults = {
  max_volatility_pct: number;
  default_harvest_bands: Array<{ id: string; trigger_pct: number; sell_pct: number }>;
  fee_assumptions: Record<string, number>;
  emergency_disable: boolean;
  suspend_rebuys_on_btc_breakdown: boolean;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function VolatilityHarvestPage() {
  const { mode } = useTradingMode();
  const { role } = useAuth();
  const isRootAdmin = role === "root_admin";
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [harvestActivity, setHarvestActivity] = useState<TransactionRow[]>([]);
  const [rebuyHistory, setRebuyHistory] = useState<TransactionRow[]>([]);
  const [chartPoints, setChartPoints] = useState<Array<{ timestamp: string; token_accumulation_quantity: number }>>(
    [],
  );
  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>([]);
  const [adminDefaults, setAdminDefaults] = useState<AdminDefaults | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [previewActions, setPreviewActions] = useState<
    Array<{ symbol: string; action: string; reason: string; quantity: number }>
  >([]);

  const loadScreen = useCallback(async () => {
    setIsLoading(true);
    const requests = await Promise.all([
      authFetch(`/v1/me/strategies/volatility-harvest/config?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/volatility-harvest/overview?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/volatility-harvest/positions?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/volatility-harvest/harvest-activity?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/volatility-harvest/rebuy-history?trading_mode=${mode}`),
      authFetch(`/v1/me/strategies/volatility-harvest/accumulation-chart?trading_mode=${mode}`),
      isRootAdmin ? authFetch("/v1/me/strategies/volatility-harvest/admin-defaults") : Promise.resolve(null),
    ]);
    setIsLoading(false);

    const [configRes, overviewRes, positionsRes, harvestRes, rebuyRes, chartRes, adminRes] = requests;
    if (!configRes || !configRes.ok) {
      setStatus(configRes ? await parseErrorMessage(configRes) : "Could not reach API.");
      return;
    }

    const configData = (await configRes.json()) as {
      config: StrategyConfig;
      available_tokens: TokenOption[];
      admin_defaults: AdminDefaults;
    };
    setConfig(configData.config);
    setAvailableTokens(configData.available_tokens ?? []);
    setAdminDefaults(configData.admin_defaults ?? null);

    if (overviewRes?.ok) {
      setOverview((await overviewRes.json()) as Overview);
    }
    if (positionsRes?.ok) {
      const payload = (await positionsRes.json()) as { positions: PositionRow[] };
      setPositions(payload.positions ?? []);
    } else {
      setPositions([]);
    }
    if (harvestRes?.ok) {
      setHarvestActivity((await harvestRes.json()) as TransactionRow[]);
    } else {
      setHarvestActivity([]);
    }
    if (rebuyRes?.ok) {
      setRebuyHistory((await rebuyRes.json()) as TransactionRow[]);
    } else {
      setRebuyHistory([]);
    }
    if (chartRes?.ok) {
      const payload = (await chartRes.json()) as {
        points: Array<{ timestamp: string; token_accumulation_quantity: number }>;
      };
      setChartPoints(payload.points ?? []);
    } else {
      setChartPoints([]);
    }
    if (adminRes?.ok) {
      setAdminDefaults((await adminRes.json()) as AdminDefaults);
    }
  }, [isRootAdmin, mode]);

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  const saveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    const res = await authFetch("/v1/me/strategies/volatility-harvest/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
    setIsSaving(false);
    if (!res || !res.ok) {
      setStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setStatus("Volatility Harvest configuration saved.");
    await loadScreen();
  };

  const toggleEnabled = async (enabled: boolean) => {
    const endpoint = enabled ? "enable" : "disable";
    const res = await authFetch(`/v1/me/strategies/volatility-harvest/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({ trading_mode: mode }),
    });
    if (!res || !res.ok) {
      setStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setStatus(enabled ? "Volatility Harvest enabled." : "Volatility Harvest disabled.");
    await loadScreen();
  };

  const runCycle = async (execute: boolean) => {
    const endpoint = execute ? "cycle-execute" : "cycle-preview";
    const setter = execute ? setIsExecuting : setIsPreviewing;
    setter(true);
    const res = await authFetch(`/v1/me/strategies/volatility-harvest/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({ trading_mode: mode, execute }),
    });
    setter(false);
    if (!res || !res.ok) {
      setStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    const payload = (await res.json()) as {
      actions?: Array<{ symbol: string; action: string; reason: string; quantity: number }>;
      queued?: Array<{ symbol: string; action: string; reason: string; suggested_size: number }>;
    };
    setPreviewActions(
      (payload.actions ?? payload.queued ?? []).map((item) => {
        const quantity = "quantity" in item ? item.quantity : item.suggested_size;
        return {
          symbol: item.symbol,
          action: item.action,
          reason: item.reason,
          quantity: quantity ?? 0,
        };
      }),
    );
    setStatus(execute ? "Volatility Harvest cycle queued." : "Preview refreshed.");
    if (execute) await loadScreen();
  };

  const saveAdminDefaults = async () => {
    if (!isRootAdmin || !adminDefaults) return;
    const res = await authFetch("/v1/me/strategies/volatility-harvest/admin-defaults", {
      method: "PUT",
      body: JSON.stringify(adminDefaults),
    });
    if (!res || !res.ok) {
      setStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setStatus("Root admin defaults saved.");
    await loadScreen();
  };

  const chartValues = useMemo(
    () => (chartPoints.length ? chartPoints.map((point) => Number(point.token_accumulation_quantity || 0)) : [0, 0]),
    [chartPoints],
  );

  if (isLoading || !config) {
    return (
      <AppShell
        title="Volatility Harvest"
        subtitle="Core plus trading allocation with harvest and rebuy cycles."
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <RowSkeleton key={`vh-sk-${index}`} />
        ))}
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Volatility Harvest"
      subtitle={`Independent harvest strategy configuration for ${mode.toUpperCase()} mode.`}
    >
      <section className="grid gap-3 md:grid-cols-4">
        <article className="oz-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Harvested cash available</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(overview?.harvested_cash_cents ?? 0)}</p>
        </article>
        <article className="oz-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Lifetime harvested gains</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(overview?.lifetime_harvested_gains_cents ?? 0)}</p>
        </article>
        <article className="oz-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Token accumulation increase</p>
          <p className="mt-2 text-2xl font-semibold">{overview?.token_accumulation_pct ?? "0"}%</p>
        </article>
        <article className="oz-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Average rebuy efficiency</p>
          <p className="mt-2 text-2xl font-semibold">{overview?.avg_rebuy_efficiency_pct ?? "0"}%</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="oz-panel space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Strategy Overview</h2>
              <p className="text-sm text-muted">
                Status: <span className="font-semibold text-foreground">{config.enabled ? "Enabled" : "Disabled"}</span>
              </p>
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

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Target capital</span>
              <input
                type="number"
                min={0}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
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
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Core %</span>
              <input
                type="number"
                min={1}
                max={99}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={String(config.core_position_percentage)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? { ...current, core_position_percentage: Number(event.target.value || 0) }
                      : current,
                  )
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Trading %</span>
              <input
                type="number"
                min={1}
                max={99}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={String(config.trading_position_percentage)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? { ...current, trading_position_percentage: Number(event.target.value || 0) }
                      : current,
                  )
                }
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Eval interval (min)</span>
              <input
                type="number"
                min={15}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={String(config.mode_settings?.evaluation_interval_minutes ?? 30)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          mode_settings: {
                            ...(current.mode_settings ?? {}),
                            evaluation_interval_minutes: Number(event.target.value || 30),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Minimum net profit after fees
              </span>
              <input
                type="number"
                min={0}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={String(config.risk_controls?.minimum_net_profit_after_fees_usd ?? 3)}
                onChange={(event) =>
                  setConfig((current) =>
                    current
                      ? {
                          ...current,
                          risk_controls: {
                            ...(current.risk_controls ?? {}),
                            minimum_net_profit_after_fees_usd: Number(event.target.value || 0),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Token selection</h3>
            <div className="flex flex-wrap gap-2">
              {availableTokens.map((token) => {
                const selected = config.selected_tokens.includes(token.symbol);
                return (
                  <button
                    key={token.symbol}
                    type="button"
                    onClick={() =>
                      setConfig((current) =>
                        current
                          ? {
                              ...current,
                              selected_tokens: selected
                                ? current.selected_tokens.filter((value) => value !== token.symbol)
                                : [...current.selected_tokens, token.symbol],
                            }
                          : current,
                      )
                    }
                    className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                      selected ? "border-sky-400 bg-sky-500/10 text-sky-200" : "border-border text-muted"
                    }`}
                  >
                    {token.symbol}
                    {token.ecosystem ? ` · ${token.ecosystem}` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Profit harvest bands</h3>
              {config.harvest_bands.map((band, index) => (
                <div key={band.id} className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                    value={String(band.trigger_pct)}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? {
                              ...current,
                              harvest_bands: current.harvest_bands.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, trigger_pct: Number(event.target.value || 0) }
                                  : item,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                  <input
                    type="number"
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                    value={String(band.sell_pct)}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? {
                              ...current,
                              harvest_bands: current.harvest_bands.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, sell_pct: Number(event.target.value || 0) }
                                  : item,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Rebuy bands</h3>
              {config.rebuy_bands.map((band, index) => (
                <div key={band.id} className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                    value={String(band.trigger_pct)}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? {
                              ...current,
                              rebuy_bands: current.rebuy_bands.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, trigger_pct: Number(event.target.value || 0) }
                                  : item,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                  <input
                    type="number"
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                    value={String(band.deploy_cash_pct)}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? {
                              ...current,
                              rebuy_bands: current.rebuy_bands.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, deploy_cash_pct: Number(event.target.value || 0) }
                                  : item,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={isSaving}
              className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save config"}
            </button>
            <button
              type="button"
              onClick={() => void runCycle(false)}
              disabled={isPreviewing}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-60"
            >
              {isPreviewing ? "Previewing..." : "Preview cycle"}
            </button>
            <button
              type="button"
              onClick={() => void runCycle(true)}
              disabled={isExecuting}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-60"
            >
              {isExecuting ? "Queueing..." : "Queue cycle"}
            </button>
          </div>
        </article>

        <article className="space-y-4">
          <div className="oz-panel p-4">
            <h2 className="text-sm font-semibold">Harvested Profit Metrics</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Realized gains</dt>
                <dd>{formatMoney(overview?.realized_gains_cents ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Unrealized gains</dt>
                <dd>{formatMoney(overview?.unrealized_gains_cents ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Harvested cash</dt>
                <dd>{formatMoney(overview?.harvested_cash_cents ?? 0)}</dd>
              </div>
            </dl>
          </div>

          <div className="oz-panel p-4">
            <h2 className="text-sm font-semibold">Queued / Preview Actions</h2>
            <div className="mt-3 space-y-2 text-sm">
              {previewActions.length ? (
                previewActions.map((action, index) => (
                  <div key={`${action.symbol}-${index}`} className="rounded-lg border border-border/70 p-3">
                    <p className="font-semibold">
                      {action.symbol} · {action.action}
                    </p>
                    <p className="text-muted">{action.reason}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted">No current actions previewed.</p>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="oz-panel p-4">
          <h2 className="text-lg font-semibold">Core vs Trading Allocation View</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2">Token</th>
                  <th className="pb-2">Core Qty</th>
                  <th className="pb-2">Trading Qty</th>
                  <th className="pb-2">Harvested Cash</th>
                  <th className="pb-2">Accumulation</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((row) => (
                  <tr key={row.symbol} className="border-t border-border/70">
                    <td className="py-2 font-semibold">{row.symbol}</td>
                    <td className="py-2">{row.core_quantity}</td>
                    <td className="py-2">{row.trading_quantity}</td>
                    <td className="py-2">{formatMoney(row.harvested_cash_cents)}</td>
                    <td className="py-2">{row.token_accumulation_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article>
          <h2 className="mb-2 text-lg font-semibold">Token Accumulation Chart</h2>
          <GrowthChart values={chartValues} positive />
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="oz-panel p-4">
          <h2 className="text-lg font-semibold">Harvest Activity</h2>
          <div className="mt-4 space-y-2">
            {harvestActivity.length ? (
              harvestActivity.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/70 p-3 text-sm">
                  <p className="font-semibold">
                    {row.symbol} · {row.band_code ?? row.transaction_type}
                  </p>
                  <p className="text-muted">
                    Sold {row.quantity} @ {row.price} · Net {formatMoney(row.net_profit_cents)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No harvest fills recorded yet.</p>
            )}
          </div>
        </article>

        <article className="oz-panel p-4">
          <h2 className="text-lg font-semibold">Rebuy History</h2>
          <div className="mt-4 space-y-2">
            {rebuyHistory.length ? (
              rebuyHistory.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/70 p-3 text-sm">
                  <p className="font-semibold">
                    {row.symbol} · {row.band_code ?? row.transaction_type}
                  </p>
                  <p className="text-muted">
                    Bought {row.quantity} @ {row.price} · {new Date(row.occurred_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No rebuys recorded yet.</p>
            )}
          </div>
        </article>
      </section>

      {isRootAdmin && adminDefaults ? (
        <section className="oz-panel space-y-4 p-4">
          <h2 className="text-lg font-semibold">Root Admin Controls</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Max volatility %</span>
              <input
                type="number"
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={String(adminDefaults.max_volatility_pct)}
                onChange={(event) =>
                  setAdminDefaults((current) =>
                    current ? { ...current, max_volatility_pct: Number(event.target.value || 0) } : current,
                  )
                }
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={adminDefaults.emergency_disable}
                onChange={(event) =>
                  setAdminDefaults((current) =>
                    current ? { ...current, emergency_disable: event.target.checked } : current,
                  )
                }
              />
              Emergency strategy disable
            </label>
          </div>
          <button
            type="button"
            onClick={() => void saveAdminDefaults()}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
          >
            Save root admin defaults
          </button>
        </section>
      ) : null}

      {status ? <p className="text-sm text-muted">{status}</p> : null}
    </AppShell>
  );
}
