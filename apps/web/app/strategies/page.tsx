"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { fetchUserTokenPolicyMatrix, type TokenPolicyMatrixEntry } from "@/lib/admin-token-policy";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
import { getDashboardDetails, getTokens } from "@/lib/dashboard-api";
import type { DashboardDetails, TokenItem } from "@/lib/dashboard-types";
import { RowSkeleton } from "@/components/ui/skeleton";

type CatalogStrategy = {
  strategy_id: string;
  display_name: string;
  description: string | null;
  is_platform_enabled: boolean;
  is_assigned: boolean;
  is_user_enabled: boolean;
  configured: boolean;
};

type AdminStrategy = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  entry_point: string | null;
  config_schema: Record<string, unknown> | null;
  sort_order: number;
};

type RiskCapsDraft = {
  maxPositionUsd: string;
  maxDailyLossPct: string;
  maxOpenPositions: string;
};

type ConfiguredStrategy = {
  strategy_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
};

type StrategyTokenOption = {
  symbol: string;
  label: string;
  disabled: boolean;
};

const STRATEGY_GUIDANCE: Record<
  string,
  {
    cadence: string;
    behavior: string;
    riskHint: string;
  }
> = {
  dca: {
    cadence: "Evaluates every 5 minutes, but buys only when the interval is eligible.",
    behavior: "Trades infrequently by design and can be healthy even when it is quiet.",
    riskHint: "Best read as a paced accumulation strategy, not a constant signal generator.",
  },
  momentum: {
    cadence: "Evaluates every 30 seconds looking for confirmed momentum setups.",
    behavior: "Usually waits on confidence, volume, spread, or fee economics before acting.",
    riskHint: "Strongest when fresh candles and volume confirmation line up together.",
  },
  day_trading: {
    cadence: "Evaluates every 60 seconds for short-horizon breakout conditions.",
    behavior: "Often stays quiet unless volume, volatility, and trend alignment all pass.",
    riskHint: "Fast strategy, but still heavily filtered by execution quality and market freshness.",
  },
  reversion: {
    cadence: "Evaluates every 60 seconds for stretched mean-reversion setups.",
    behavior: "Selective by design; trend filters and bandwidth checks can keep it idle for long periods.",
    riskHint: "Looks quiet in trending markets because it is waiting for oversold snap-back conditions.",
  },
  strategic_aggressive_allocation: {
    cadence: "Evaluates hourly and manages bucket-level reallocations rather than frequent trades.",
    behavior: "Acts more like a capital allocator than a high-frequency entry engine.",
    riskHint: "Expect rebalance-style activity, profit-taking, and bucket management instead of constant signals.",
  },
};

function normalizeStrategyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function formatReasonLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatIntervalHours(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  return value === 1 ? "1 hour" : `${value} hours`;
}

function getConfigSymbols(config: Record<string, unknown> | null | undefined): string[] {
  const requested = config?.symbols;
  if (!Array.isArray(requested)) return [];
  return requested
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

export default function StrategiesPage() {
  const { role } = useAuth();
  const { mode } = useTradingMode();
  const [catalogStrategies, setCatalogStrategies] = useState<CatalogStrategy[]>([]);
  const [configuredStrategies, setConfiguredStrategies] = useState<Record<string, ConfiguredStrategy>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokenItem[]>([]);
  const [policyMatrix, setPolicyMatrix] = useState<TokenPolicyMatrixEntry[]>([]);
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string[]>>({});
  const [strategyHealth, setStrategyHealth] = useState<DashboardDetails["strategyHealth"]>([]);
  const [botHealth, setBotHealth] = useState<DashboardDetails["botHealth"] | null>(null);

  const [adminStrategies, setAdminStrategies] = useState<AdminStrategy[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [entryPoint, setEntryPoint] = useState("oziebot.strategies");
  const [openRiskFor, setOpenRiskFor] = useState<string | null>(null);
  const [openSignalFor, setOpenSignalFor] = useState<string | null>(null);
  const [riskDrafts, setRiskDrafts] = useState<Record<string, RiskCapsDraft>>({});
  const [signalDrafts, setSignalDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isRootAdmin = role === "root_admin";

  const loadStrategies = useCallback(async () => {
    setIsLoading(true);
    const [catalogRes, configuredRes] = await Promise.all([
      authFetch("/v1/me/strategies/catalog"),
      authFetch("/v1/me/strategies"),
    ]);
    setIsLoading(false);
    if (!catalogRes || !catalogRes.ok) return;
    const data = (await catalogRes.json()) as { strategies: CatalogStrategy[] };
    setCatalogStrategies(data.strategies ?? []);

    if (!configuredRes || !configuredRes.ok) {
      setConfiguredStrategies({});
      return;
    }

    const configuredPayload = (await configuredRes.json()) as {
      strategies: ConfiguredStrategy[];
    };
    const configuredMap = Object.fromEntries(
      (configuredPayload.strategies ?? []).map((strategy) => [strategy.strategy_id, strategy]),
    );
    setConfiguredStrategies(configuredMap);
    setTokenDrafts((current) => {
      const next = { ...current };
      for (const strategy of configuredPayload.strategies ?? []) {
        if (next[strategy.strategy_id] === undefined) {
          next[strategy.strategy_id] = getConfigSymbols(strategy.config);
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const loadStrategyHealth = useCallback(async () => {
    setHealthLoading(true);
    const details = await getDashboardDetails(mode);
    if (!details) {
      setStrategyHealth([]);
      setBotHealth(null);
      setHealthLoading(false);
      return;
    }
    setStrategyHealth(details.strategyHealth ?? []);
    setBotHealth(details.botHealth ?? null);
    setHealthLoading(false);
  }, [mode]);

  useEffect(() => {
    void loadStrategyHealth();
  }, [loadStrategyHealth]);

  const loadTokenControls = useCallback(async () => {
    setTokensLoading(true);
    const [tokens, matrixResponse] = await Promise.all([
      getTokens(mode),
      fetchUserTokenPolicyMatrix(),
    ]);
    setAvailableTokens(tokens.filter((token) => token.enabled));
    setPolicyMatrix(matrixResponse.data ?? []);
    setTokensLoading(false);
  }, [mode]);

  useEffect(() => {
    void loadTokenControls();
  }, [loadTokenControls]);

  const loadAdminStrategies = useCallback(async () => {
    if (!isRootAdmin) return;
    setAdminLoading(true);
    const res = await authFetch("/v1/admin/platform/strategies");
    setAdminLoading(false);
    if (!res) {
      setAdminStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      return;
    }
    setAdminStrategies((await res.json()) as AdminStrategy[]);
  }, [isRootAdmin]);

  useEffect(() => {
    loadAdminStrategies();
  }, [loadAdminStrategies]);

  const createAdminStrategy = async () => {
    setAdminStatus(null);
    if (!slug.trim() || !displayName.trim()) {
      setAdminStatus("Slug and display name are required.");
      return;
    }
    const res = await authFetch("/v1/admin/platform/strategies", {
      method: "POST",
      body: JSON.stringify({
        slug: slug.trim().toLowerCase(),
        display_name: displayName.trim(),
        description: description.trim() || null,
        is_enabled: true,
        entry_point: entryPoint.trim() || null,
        config_schema: null,
        sort_order: 0,
      }),
    });
    if (!res) {
      setAdminStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      return;
    }
    setAdminStatus("Strategy created.");
    setSlug("");
    setDisplayName("");
    setDescription("");
    await Promise.all([loadAdminStrategies(), loadStrategies()]);
  };

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]/g, "");

  const getAdminForStrategy = (strategyId: string): AdminStrategy | null =>
    adminStrategies.find((s) => s.slug === strategyId) ??
    adminStrategies.find((s) => normalize(s.slug) === normalize(strategyId)) ??
    null;

  const toggleStrategyCard = async (strategyId: string, enabled: boolean) => {
    setActionKey(strategyId);
    setUserStatus(null);
    const res = await authFetch(`/v1/me/strategies/${strategyId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_enabled: !enabled }),
    });
    setActionKey(null);
    if (!res) {
      setUserStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setUserStatus(await parseErrorMessage(res));
      return;
    }
    await Promise.all([loadStrategies(), loadStrategyHealth()]);
  };

  const tokenOptionsByStrategy = useMemo(() => {
    const tokenNameBySymbol = new Map(
      availableTokens.map((token) => [token.symbol, token.name ?? token.symbol]),
    );
    const options = new Map<string, StrategyTokenOption[]>();

    for (const entry of policyMatrix) {
      if (!entry.platform_token_enabled || !entry.user_token_enabled) continue;
      for (const policy of entry.strategy_policies) {
        const strategyId = policy.strategy_id;
        const current = options.get(strategyId) ?? [];
        const displayName = tokenNameBySymbol.get(entry.token.symbol);
        const status = policy.effective_recommendation_status;
        current.push({
          symbol: entry.token.symbol,
          label:
            displayName && displayName !== entry.token.symbol
              ? `${entry.token.symbol} · ${displayName} · ${status}`
              : `${entry.token.symbol} · ${status}`,
          disabled: !policy.is_enabled || status === "blocked",
        });
        options.set(strategyId, current);
      }
    }

    for (const [strategyId, rows] of options.entries()) {
      rows.sort((left, right) => left.symbol.localeCompare(right.symbol));
      options.set(strategyId, rows);
    }

    return options;
  }, [availableTokens, policyMatrix]);

  const strategyHealthById = useMemo(() => {
    const entries = strategyHealth.map(
      (entry) => [normalizeStrategyKey(entry.id), entry] as const,
    );
    return new Map<string, DashboardDetails["strategyHealth"][number]>(entries);
  }, [strategyHealth]);

  const saveStrategyTokens = async (strategy: CatalogStrategy) => {
    const draft = tokenDrafts[strategy.strategy_id] ?? getConfigSymbols(configuredStrategies[strategy.strategy_id]?.config);
    const existingConfig = { ...(configuredStrategies[strategy.strategy_id]?.config ?? {}) };
    if (draft.length > 0) {
      existingConfig.symbols = draft;
    } else {
      delete existingConfig.symbols;
    }

    setSavingKey(`tokens-${strategy.strategy_id}`);
    setUserStatus(null);
    const res = await authFetch(`/v1/me/strategies/${strategy.strategy_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        is_enabled: configuredStrategies[strategy.strategy_id]?.is_enabled ?? strategy.is_user_enabled,
        config: existingConfig,
      }),
    });
    setSavingKey(null);
    if (!res) {
      setUserStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setUserStatus(await parseErrorMessage(res));
      return;
    }
    setUserStatus(
      draft.length > 0
        ? `Saved ${draft.length} token${draft.length === 1 ? "" : "s"} for ${strategy.display_name}.`
        : `Cleared token filter for ${strategy.display_name}; it will use all enabled tokens again.`,
    );
    await Promise.all([loadStrategies(), loadStrategyHealth()]);
  };

  const togglePlatformEnabled = async (adminStrategyId: string, currentEnabled: boolean) => {
    const res = await authFetch(`/v1/admin/platform/strategies/${adminStrategyId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_enabled: !currentEnabled }),
    });
    if (!res || !res.ok) {
      setAdminStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setAdminStatus(null);
    await Promise.all([loadAdminStrategies(), loadStrategies(), loadStrategyHealth()]);
  };

  const deletePlatformStrategy = async (strategy: AdminStrategy) => {
    const ok = window.confirm(
      `Delete ${strategy.display_name} (${strategy.slug}) from platform catalog?`,
    );
    if (!ok) return;
    setDeletingId(strategy.id);
    const res = await authFetch(`/v1/admin/platform/strategies/${strategy.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (!res || !res.ok) {
      setAdminStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setAdminStatus("Strategy deleted.");
    await Promise.all([loadAdminStrategies(), loadStrategies()]);
  };

  const getRiskCapsFromConfig = (strategy: AdminStrategy): RiskCapsDraft => {
    const cfg = strategy.config_schema ?? {};
    const risk = (cfg as { risk_caps?: Record<string, unknown> }).risk_caps ?? {};
    return {
      maxPositionUsd: String(risk.max_position_usd ?? ""),
      maxDailyLossPct: String(risk.max_daily_loss_pct ?? ""),
      maxOpenPositions: String(risk.max_open_positions ?? ""),
    };
  };

  const getSignalRulesFromConfig = (strategy: AdminStrategy): string => {
    const cfg = strategy.config_schema ?? {};
    const signalRules = (cfg as { signal_rules?: unknown }).signal_rules ?? {};
    return JSON.stringify(signalRules, null, 2);
  };

  const saveRiskCaps = async (strategySlug: string) => {
    const adminStrategy = getAdminForStrategy(strategySlug);
    if (!adminStrategy) {
      setAdminStatus("No matching admin strategy found.");
      return;
    }
    const draft = riskDrafts[strategySlug] ?? getRiskCapsFromConfig(adminStrategy);
    const toNum = (value: string) => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };
    const nextRisk = {
      max_position_usd: toNum(draft.maxPositionUsd),
      max_daily_loss_pct: toNum(draft.maxDailyLossPct),
      max_open_positions: toNum(draft.maxOpenPositions),
    };
    if (Object.values(nextRisk).some((value) => Number.isNaN(value))) {
      setAdminStatus("Risk caps must be numeric.");
      return;
    }
    setSavingKey(`risk-${strategySlug}`);
    const res = await authFetch(`/v1/admin/platform/strategies/${adminStrategy.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        config_schema: { ...(adminStrategy.config_schema ?? {}), risk_caps: nextRisk },
      }),
    });
    setSavingKey(null);
    if (!res || !res.ok) {
      setAdminStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setAdminStatus("Risk caps saved.");
    await loadAdminStrategies();
  };

  const saveSignalRules = async (strategySlug: string) => {
    const adminStrategy = getAdminForStrategy(strategySlug);
    if (!adminStrategy) {
      setAdminStatus("No matching admin strategy found.");
      return;
    }
    const draft = signalDrafts[strategySlug] ?? getSignalRulesFromConfig(adminStrategy);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setAdminStatus("Signal rules must be valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setAdminStatus("Signal rules must be a JSON object.");
      return;
    }
    setSavingKey(`signal-${strategySlug}`);
    const res = await authFetch(`/v1/admin/platform/strategies/${adminStrategy.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        config_schema: { ...(adminStrategy.config_schema ?? {}), signal_rules: parsed },
      }),
    });
    setSavingKey(null);
    if (!res || !res.ok) {
      setAdminStatus(res ? await parseErrorMessage(res) : "Could not reach API.");
      return;
    }
    setAdminStatus("Signal rules saved.");
    await loadAdminStrategies();
  };

  return (
    <AppShell title="Strategy Toggles" subtitle="Manage strategy activation and per-mode controls.">
      {isRootAdmin ? (
        <section className="oz-panel space-y-3 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Root Admin: Strategy Catalog</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Slug (e.g. momentum)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400 sm:col-span-2"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400 sm:col-span-2"
              placeholder="Entry point"
              value={entryPoint}
              onChange={(e) => setEntryPoint(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="h-10 rounded-lg bg-amber-400 px-3 text-sm font-semibold text-slate-950"
            onClick={createAdminStrategy}
          >
            Add to Catalog
          </button>
          {adminStatus ? <p className="text-xs text-muted">{adminStatus}</p> : null}

          <div className="space-y-2">
            {adminLoading ? <RowSkeleton /> : adminStrategies.map((strategy) => {
              const riskDraft = riskDrafts[strategy.slug] ?? getRiskCapsFromConfig(strategy);
              const signalDraft = signalDrafts[strategy.slug] ?? getSignalRulesFromConfig(strategy);
              return (
                <div key={strategy.id} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between p-2">
                    <p className="text-xs text-muted">
                      {strategy.display_name} · <span className="font-mono">{strategy.slug}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => togglePlatformEnabled(strategy.id, strategy.is_enabled)}
                      className={`h-8 rounded-lg px-2 text-xs font-semibold ${strategy.is_enabled ? "bg-sky-400/20 text-sky-400" : "bg-surface text-muted"}`}
                    >
                      {strategy.is_enabled ? "Platform On" : "Platform Off"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-2 pb-2">
                    <p className="text-xs text-muted/70">{strategy.description ?? "No description"}</p>
                    <button
                      type="button"
                      disabled={deletingId === strategy.id}
                      onClick={() => deletePlatformStrategy(strategy)}
                      className="h-8 rounded-lg border border-red-400/40 bg-red-500/10 px-2 text-xs font-semibold text-red-300 disabled:opacity-50"
                    >
                      {deletingId === strategy.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 border-t border-border px-2 pb-2 pt-1">
                    <button
                      type="button"
                      className="h-8 rounded-lg border border-border bg-surface text-xs text-muted"
                      onClick={() => setOpenRiskFor((current) => (current === strategy.slug ? null : strategy.slug))}
                    >
                      {openRiskFor === strategy.slug ? "Hide Risk Caps" : "Risk Caps"}
                    </button>
                    <button
                      type="button"
                      className="h-8 rounded-lg border border-border bg-surface text-xs text-muted"
                      onClick={() => setOpenSignalFor((current) => (current === strategy.slug ? null : strategy.slug))}
                    >
                      {openSignalFor === strategy.slug ? "Hide Signal Rules" : "Signal Rules"}
                    </button>
                  </div>
                  {openRiskFor === strategy.slug ? (
                    <section className="space-y-2 border-t border-border px-2 pb-2 pt-1">
                      <div className="grid grid-cols-3 gap-1">
                        {(["maxPositionUsd", "maxDailyLossPct", "maxOpenPositions"] as const).map((field, index) => (
                          <input
                            key={field}
                            className="h-9 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-sky-400"
                            placeholder={["Max pos USD", "Daily loss %", "Max open"][index]}
                            value={riskDraft[field]}
                            onChange={(e) =>
                              setRiskDrafts((current) => ({
                                ...current,
                                [strategy.slug]: { ...riskDraft, [field]: e.target.value },
                              }))
                            }
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={savingKey === `risk-${strategy.slug}`}
                        onClick={() => saveRiskCaps(strategy.slug)}
                        className="h-8 rounded-lg bg-amber-400 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50"
                      >
                        {savingKey === `risk-${strategy.slug}` ? "Saving..." : "Save Risk Caps"}
                      </button>
                    </section>
                  ) : null}
                  {openSignalFor === strategy.slug ? (
                    <section className="space-y-2 border-t border-border px-2 pb-2 pt-1">
                      <textarea
                        className="h-32 w-full rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs outline-none focus:border-sky-400"
                        value={signalDraft}
                        onChange={(e) =>
                          setSignalDrafts((current) => ({ ...current, [strategy.slug]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        disabled={savingKey === `signal-${strategy.slug}`}
                        onClick={() => saveSignalRules(strategy.slug)}
                        className="h-8 rounded-lg bg-amber-400 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50"
                      >
                        {savingKey === `signal-${strategy.slug}` ? "Saving..." : "Save Signal Rules"}
                      </button>
                    </section>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {userStatus ? <p className="px-1 text-xs text-amber-400">{userStatus}</p> : null}
      {healthLoading ? (
        <RowSkeleton />
      ) : botHealth ? (
        <section className="oz-panel mb-2 space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Strategy health</p>
            <span className="rounded-full border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {botHealth.mode}
            </span>
            <span
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                botHealth.overallStatus === "healthy"
                  ? "border-positive/40 bg-positive/15 text-positive"
                  : botHealth.overallStatus === "critical"
                    ? "border-negative/40 bg-negative/15 text-negative"
                    : "border-amber-500/40 bg-amber-500/15 text-amber-100"
              }`}
            >
              {formatReasonLabel(botHealth.overallStatus)}
            </span>
          </div>
          <p className="text-sm text-foreground">{botHealth.quietReason}</p>
          <p className="text-xs text-muted">
            Reconciliation {formatReasonLabel(botHealth.reconciliation.status)} · Market data{" "}
            {formatReasonLabel(botHealth.marketData.status)} · Last trade {formatTimestamp(botHealth.lastSuccessfulTradeAt)}
          </p>
        </section>
      ) : null}
      {isRootAdmin ? (
        <section className="oz-panel mb-2 p-3 text-xs text-muted">
          Root admin accounts see the full strategy catalog by default. Tenant users only see strategies assigned by trial or subscription.
        </section>
      ) : null}

      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, idx) => <RowSkeleton key={`strategy-skeleton-${idx}`} />)
          : catalogStrategies.length === 0
              ? <section className="oz-panel p-3 text-sm text-muted">No strategies assigned to this account yet.</section>
              : catalogStrategies.map((strategy) => {
                  const isActing = actionKey === strategy.strategy_id;
                  const isStrategicAllocation =
                    strategy.strategy_id === "strategic_aggressive_allocation";
                  const strategyKey = normalizeStrategyKey(strategy.strategy_id);
                  const health = strategyHealthById.get(strategyKey) ?? null;
                  const guidance = STRATEGY_GUIDANCE[strategyKey] ?? {
                    cadence: "Cadence depends on strategy configuration and market conditions.",
                    behavior: "This strategy can remain quiet when its validation gates are not satisfied.",
                    riskHint: "Use the blocker state below to see why it is active, waiting, or blocked.",
                  };
                  const dcaTiming =
                    strategyKey === "dca"
                      ? [
                          health?.lastBuyAt ? `Last buy ${formatTimestamp(health.lastBuyAt)}` : null,
                          formatIntervalHours(health?.dcaIntervalHours)
                            ? `Interval ${formatIntervalHours(health?.dcaIntervalHours)}`
                            : null,
                          health?.nextEligibleAt ? `Next eligible ${formatTimestamp(health.nextEligibleAt)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : null;
                  const strategyOptions =
                    tokenOptionsByStrategy.get(strategy.strategy_id) ??
                    availableTokens
                     .map((token) => ({
                       symbol: token.symbol,
                       label:
                         token.name && token.name !== token.symbol
                           ? `${token.symbol} · ${token.name}`
                           : token.symbol,
                       disabled: false,
                     }))
                     .sort((left, right) => left.symbol.localeCompare(right.symbol));
                 const draftSymbols =
                   tokenDrafts[strategy.strategy_id] ??
                   getConfigSymbols(configuredStrategies[strategy.strategy_id]?.config);
                 const unavailableSelected = draftSymbols.filter(
                   (symbol) => !strategyOptions.some((option) => option.symbol === symbol),
                 );
                 return (
                    <article key={strategy.strategy_id} className="oz-panel p-3">
                      <div className="flex items-start justify-between gap-2">
                       <div className="min-w-0">
                         <p className="text-sm font-semibold">{strategy.display_name}</p>
                         <p className="text-xs text-muted">{strategy.description ?? "No description"}</p>
                        <p className="mt-1 font-mono text-xs text-muted/50">{strategy.strategy_id}</p>
                        {!isRootAdmin ? (
                          <p className="mt-1 text-xs text-muted/70">
                             {strategy.configured ? "Assigned and configured" : "Assigned by subscription or trial"}
                           </p>
                         ) : null}
                       </div>
                      <button
                        type="button"
                        disabled={isActing || (!isRootAdmin && !strategy.is_platform_enabled)}
                        onClick={() => toggleStrategyCard(strategy.strategy_id, strategy.is_user_enabled)}
                        className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${strategy.is_user_enabled ? "bg-positive/20 text-positive" : "border border-border bg-surface text-muted"}`}
                      >
                        {isActing ? "..." : strategy.is_user_enabled ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                      <section className="mt-3 rounded-lg border border-border bg-surface/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              health?.currentStatus === "ready" || health?.currentStatus === "managing_position"
                                ? "border-positive/40 bg-positive/15 text-positive"
                                : health?.currentStatus === "blocked"
                                  ? "border-negative/40 bg-negative/15 text-negative"
                                  : "border-border bg-card text-muted"
                            }`}
                          >
                            {formatReasonLabel(health?.currentStatus ?? (strategy.is_user_enabled ? "enabled" : "disabled"))}
                          </span>
                          <span className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            {strategy.is_user_enabled ? "enabled" : "disabled"}
                          </span>
                          {health?.blockingReasonCode ? (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                              {formatReasonLabel(health.blockingReasonCode)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
                          <div>
                            <p className="font-semibold uppercase tracking-wide text-muted">Expected cadence</p>
                            <p className="mt-1 text-foreground">{guidance.cadence}</p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-wide text-muted">Expected behavior</p>
                            <p className="mt-1 text-foreground">{guidance.behavior}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                          <div>Last evaluation {formatTimestamp(health?.lastEvaluatedAt)}</div>
                          <div className="text-right">Last signal {formatTimestamp(health?.lastSignalAt)}</div>
                          <div>
                            Last action {health?.lastSignalAction ? formatReasonLabel(health.lastSignalAction) : "—"}
                          </div>
                          <div className="text-right">
                            {strategyKey === "dca" ? "Last buy" : "Last trade"}{" "}
                            {formatTimestamp(strategyKey === "dca" ? health?.lastBuyAt : health?.lastTradeAt)}
                          </div>
                          <div>Open positions {health?.openPositions ?? 0}</div>
                          <div className="text-right">Allocation {health?.allocationPct ?? 0}%</div>
                        </div>
                        <div className="mt-3 rounded-lg border border-border/70 bg-card px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Current blocker</p>
                          <p className="mt-1 text-sm text-foreground">
                            {health?.blockingReasonDetail ??
                              health?.lastSignalReason ??
                              (strategy.is_user_enabled
                                ? "No blocker recorded right now. This strategy should evaluate normally."
                                : "Enable this strategy to allow it to evaluate and trade.")}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {[
                              dcaTiming,
                              health?.exitMonitoredPositions
                                ? `Exit watch ${health.exitMonitoredPositions}`
                                : null,
                              health?.stalledExitCount
                                ? `Stalled exits ${health.stalledExitCount}`
                                : null,
                              guidance.riskHint,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </section>
                      {!strategy.is_platform_enabled ? (
                        <p className="mt-2 text-xs text-amber-400">Platform-disabled. Tenant users cannot enable this strategy.</p>
                      ) : null}
                     <section className="mt-3 rounded-lg border border-border bg-surface/40 p-3">
                       <div className="flex items-center justify-between gap-2">
                         <div>
                           <p className="text-xs font-semibold uppercase tracking-wide text-muted">Strategy tokens</p>
                           <p className="text-xs text-muted">
                             Pick the tokens this strategy is allowed to trade. Leave empty to use all globally enabled tokens.
                           </p>
                         </div>
                         <p className="text-xs text-muted">Selected: {draftSymbols.length}</p>
                       </div>
                       {isStrategicAllocation ? (
                         <p className="mt-3 text-xs text-muted">
                           Strategic Allocation already has its own token selectors on the Strategic Allocation page.
                         </p>
                       ) : tokensLoading ? (
                         <div className="mt-3">
                           <RowSkeleton />
                         </div>
                       ) : strategyOptions.length === 0 ? (
                         <p className="mt-3 text-xs text-muted">
                           No eligible tokens available yet. Enable tokens on the Tokens page first.
                         </p>
                       ) : (
                         <>
                           <select
                             multiple
                             className="mt-3 min-h-32 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                             value={draftSymbols}
                             onChange={(event) =>
                               setTokenDrafts((current) => ({
                                 ...current,
                                 [strategy.strategy_id]: Array.from(event.target.selectedOptions).map(
                                   (option) => option.value,
                                 ),
                               }))
                             }
                           >
                             {strategyOptions.map((option) => (
                               <option
                                 key={`${strategy.strategy_id}-${option.symbol}`}
                                 value={option.symbol}
                                 disabled={option.disabled}
                               >
                                 {option.label}
                               </option>
                             ))}
                           </select>
                           {unavailableSelected.length > 0 ? (
                             <p className="mt-2 text-xs text-amber-400">
                               Currently unavailable: {unavailableSelected.join(", ")}
                             </p>
                           ) : null}
                           <div className="mt-3 flex flex-wrap gap-2">
                             <button
                               type="button"
                               onClick={() =>
                                 setTokenDrafts((current) => ({
                                   ...current,
                                   [strategy.strategy_id]: [],
                                 }))
                               }
                               className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted"
                             >
                               Use all enabled tokens
                             </button>
                             <button
                               type="button"
                               disabled={savingKey === `tokens-${strategy.strategy_id}`}
                               onClick={() => saveStrategyTokens(strategy)}
                               className="h-8 rounded-lg bg-amber-400 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50"
                             >
                               {savingKey === `tokens-${strategy.strategy_id}` ? "Saving..." : "Save token list"}
                             </button>
                           </div>
                         </>
                       )}
                     </section>
                   </article>
                 );
               })}
      </div>
    </AppShell>
  );
}
