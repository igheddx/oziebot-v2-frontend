"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
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

export default function StrategiesPage() {
  const { role } = useAuth();
  const [catalogStrategies, setCatalogStrategies] = useState<CatalogStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);

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
    const res = await authFetch("/v1/me/strategies/catalog");
    setIsLoading(false);
    if (!res || !res.ok) return;
    const data = (await res.json()) as { strategies: CatalogStrategy[] };
    setCatalogStrategies(data.strategies ?? []);
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

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
    await loadStrategies();
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
    await Promise.all([loadAdminStrategies(), loadStrategies()]);
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
                    {!strategy.is_platform_enabled ? (
                      <p className="mt-2 text-xs text-amber-400">Platform-disabled. Tenant users cannot enable this strategy.</p>
                    ) : null}
                  </article>
                );
              })}
      </div>
    </AppShell>
  );
}
