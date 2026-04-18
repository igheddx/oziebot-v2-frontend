"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { RowSkeleton } from "@/components/ui/skeleton";
import {
  fetchTokenPolicyDecisions,
  fetchTokenPolicyMatrix,
  recalculateTokenPolicy,
  updateTokenStrategyPolicy,
  type TokenPolicyDecision,
  type TokenPolicyMatrixEntry,
  type TokenStrategyPolicy,
} from "@/lib/admin-token-policy";

type PolicyDraft = {
  adminEnabled: boolean;
  recommendationStatus: "" | "preferred" | "allowed" | "discouraged" | "blocked";
  recommendationReason: string;
  maxPositionPctOverride: string;
  notes: string;
};

type DecisionFilterState = {
  symbol: string;
  strategy_id: string;
  trading_mode: "" | "paper" | "live";
  outcome: "" | "emitted" | "reduced" | "rejected" | "executed";
};

function makeDraft(policy: TokenStrategyPolicy): PolicyDraft {
  return {
    adminEnabled: policy.admin_enabled,
    recommendationStatus:
      (policy.recommendation_status_override as PolicyDraft["recommendationStatus"]) ?? "",
    recommendationReason: policy.recommendation_reason_override ?? "",
    maxPositionPctOverride:
      policy.max_position_pct_override == null ? "" : String(policy.max_position_pct_override),
    notes: policy.notes ?? "",
  };
}

function statusTone(status: string) {
  switch (status) {
    case "preferred":
      return "bg-positive/15 text-positive";
    case "discouraged":
      return "bg-amber-400/20 text-amber-300";
    case "blocked":
      return "bg-negative/15 text-negative";
    default:
      return "bg-surface text-muted";
  }
}

function outcomeTone(outcome: string) {
  switch (outcome) {
    case "executed":
      return "bg-positive/15 text-positive";
    case "reduced":
      return "bg-amber-400/20 text-amber-300";
    case "rejected":
      return "bg-negative/15 text-negative";
    default:
      return "bg-surface text-muted";
  }
}

export default function AdminTokenPolicyPage() {
  const { role } = useAuth();
  const isRootAdmin = role === "root_admin";
  const [matrix, setMatrix] = useState<TokenPolicyMatrixEntry[]>([]);
  const [decisions, setDecisions] = useState<TokenPolicyDecision[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadingMatrix, setLoadingMatrix] = useState(true);
  const [loadingDecisions, setLoadingDecisions] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<string | null>(null);
  const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null);
  const [recalculatingTokenId, setRecalculatingTokenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DecisionFilterState>({
    symbol: "",
    strategy_id: "",
    trading_mode: "",
    outcome: "",
  });

  const syncDrafts = useCallback((rows: TokenPolicyMatrixEntry[]) => {
    setDrafts((previous) => {
      const next = { ...previous };
      for (const token of rows) {
        for (const policy of token.strategy_policies) {
          next[policy.id] = makeDraft(policy);
        }
      }
      return next;
    });
  }, []);

  const loadMatrix = useCallback(async () => {
    if (!isRootAdmin) return;
    setLoadingMatrix(true);
    const response = await fetchTokenPolicyMatrix();
    setLoadingMatrix(false);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    const rows = response.data ?? [];
    setMatrix(rows);
    syncDrafts(rows);
    setExpandedTokenId((current) => current ?? rows[0]?.token.id ?? null);
    setStatus(null);
  }, [isRootAdmin, syncDrafts]);

  const loadDecisions = useCallback(
    async (nextFilters: DecisionFilterState) => {
      if (!isRootAdmin) return;
      setLoadingDecisions(true);
      const response = await fetchTokenPolicyDecisions({
        symbol: nextFilters.symbol || undefined,
        strategy_id: nextFilters.strategy_id || undefined,
        trading_mode: nextFilters.trading_mode || undefined,
        outcome: nextFilters.outcome || undefined,
        limit: 50,
      });
      setLoadingDecisions(false);
      if (response.error) {
        setDecisionStatus(response.error);
        return;
      }
      setDecisions(response.data ?? []);
      setDecisionStatus(null);
    },
    [isRootAdmin],
  );

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    void loadDecisions(filters);
  }, [filters, loadDecisions]);

  const filteredMatrix = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return matrix;
    return matrix.filter((entry) => {
      const haystack = `${entry.token.symbol} ${entry.token.display_name ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [matrix, search]);

  const strategyOptions = useMemo(() => {
    const seen = new Set<string>();
    return matrix
      .flatMap((entry) => entry.strategy_policies.map((policy) => policy.strategy_id))
      .filter((strategyId) => {
        if (seen.has(strategyId)) return false;
        seen.add(strategyId);
        return true;
      });
  }, [matrix]);

  const updateDraft = (policyId: string, patch: Partial<PolicyDraft>) => {
    setDrafts((current) => ({
      ...current,
      [policyId]: { ...(current[policyId] ?? ({} as PolicyDraft)), ...patch },
    }));
  };

  const onSavePolicy = async (tokenId: string, policy: TokenStrategyPolicy) => {
    const draft = drafts[policy.id] ?? makeDraft(policy);
    const maxOverride = draft.maxPositionPctOverride.trim();
    const parsedOverride = maxOverride ? Number(maxOverride) : null;
    if (
      maxOverride &&
      (parsedOverride === null ||
        !Number.isFinite(parsedOverride) ||
        parsedOverride < 0 ||
        parsedOverride > 1)
    ) {
      setStatus("Max position override must be between 0 and 1.");
      return;
    }
    setSavingPolicyId(policy.id);
    const response = await updateTokenStrategyPolicy(tokenId, policy.strategy_id, {
      admin_enabled: draft.adminEnabled,
      recommendation_status: draft.recommendationStatus || null,
      recommendation_reason: draft.recommendationReason.trim() || null,
      max_position_pct_override: parsedOverride,
      notes: draft.notes.trim() || null,
    });
    setSavingPolicyId(null);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    setStatus(`${policy.strategy_display_name ?? policy.strategy_id} policy saved.`);
    await Promise.all([loadMatrix(), loadDecisions(filters)]);
  };

  const onRecalculate = async (tokenId: string) => {
    setRecalculatingTokenId(tokenId);
    const response = await recalculateTokenPolicy(tokenId);
    setRecalculatingTokenId(null);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    setStatus("Token policy recalculated.");
    await Promise.all([loadMatrix(), loadDecisions(filters)]);
  };

  if (!isRootAdmin) {
    return (
      <AppShell title="Token Strategy Policy" subtitle="Root admin access is required.">
        <section className="oz-panel p-4 text-sm text-muted">
          This screen is only available to root admins because it changes live token-strategy enforcement.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Token Strategy Policy"
      subtitle="Manage computed vs effective policy and inspect recent strategy, risk, and execution enforcement."
      showModeToggle={false}
    >
      <section className="oz-panel space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Policy Matrix</p>
            <p className="text-xs text-muted">Real backend profiles, suitability scores, and admin overrides.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
            onClick={() => void loadMatrix()}
          >
            Refresh
          </button>
        </div>
        <input
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
          placeholder="Filter tokens by symbol or name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {status ? <p className="text-xs text-muted">{status}</p> : null}
        {loadingMatrix ? (
          Array.from({ length: 3 }).map((_, index) => <RowSkeleton key={`matrix-skeleton-${index}`} />)
        ) : filteredMatrix.length === 0 ? (
          <p className="text-sm text-muted">No token policies found.</p>
        ) : (
          filteredMatrix.map((entry) => {
            const expanded = expandedTokenId === entry.token.id;
            return (
              <article key={entry.token.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {entry.token.symbol} · {entry.token.display_name ?? entry.token.symbol}
                    </p>
                    <p className="text-xs text-muted">
                      {entry.token.quote_currency} · {entry.market_profile?.last_computed_at ? new Date(entry.market_profile.last_computed_at).toLocaleString() : "Not computed yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
                      disabled={recalculatingTokenId === entry.token.id}
                      onClick={() => void onRecalculate(entry.token.id)}
                    >
                      {recalculatingTokenId === entry.token.id ? "Recalculating..." : "Recalculate"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
                      onClick={() => setExpandedTokenId(expanded ? null : entry.token.id)}
                    >
                      {expanded ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {[
                    ["Liquidity", entry.market_profile?.liquidity_score],
                    ["Spread", entry.market_profile?.spread_score],
                    ["Volatility", entry.market_profile?.volatility_score],
                    ["Trend", entry.market_profile?.trend_score],
                    ["Reversion", entry.market_profile?.reversion_score],
                    ["Slippage", entry.market_profile?.slippage_score],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-surface px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
                      <p className="mt-1 font-semibold text-foreground">{value == null ? "—" : Number(value).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {expanded ? (
                  <div className="mt-4 space-y-3">
                    {entry.strategy_policies.map((policy) => {
                      const draft = drafts[policy.id] ?? makeDraft(policy);
                      return (
                        <div key={policy.id} className="rounded-xl border border-border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{policy.strategy_display_name ?? policy.strategy_id}</p>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(policy.computed_recommendation_status)}`}>
                              computed: {policy.computed_recommendation_status}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(policy.effective_recommendation_status)}`}>
                              effective: {policy.effective_recommendation_status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted">
                            Suitability {policy.suitability_score.toFixed(2)} · {policy.computed_recommendation_reason ?? "No computed reason"}
                          </p>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                              <span className="mb-1 block">Admin enabled</span>
                              <select
                                className="w-full bg-transparent text-sm text-foreground outline-none"
                                value={draft.adminEnabled ? "true" : "false"}
                                onChange={(event) => updateDraft(policy.id, { adminEnabled: event.target.value === "true" })}
                              >
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                              </select>
                            </label>
                            <label className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                              <span className="mb-1 block">Override status</span>
                              <select
                                className="w-full bg-transparent text-sm text-foreground outline-none"
                                value={draft.recommendationStatus}
                                onChange={(event) =>
                                  updateDraft(policy.id, {
                                    recommendationStatus: event.target.value as PolicyDraft["recommendationStatus"],
                                  })
                                }
                              >
                                <option value="">Computed default</option>
                                <option value="preferred">Preferred</option>
                                <option value="allowed">Allowed</option>
                                <option value="discouraged">Discouraged</option>
                                <option value="blocked">Blocked</option>
                              </select>
                            </label>
                            <label className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                              <span className="mb-1 block">Override reason</span>
                              <input
                                className="w-full bg-transparent text-sm text-foreground outline-none"
                                value={draft.recommendationReason}
                                onChange={(event) => updateDraft(policy.id, { recommendationReason: event.target.value })}
                                placeholder="Optional admin reason"
                              />
                            </label>
                            <label className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                              <span className="mb-1 block">Max position pct override</span>
                              <input
                                className="w-full bg-transparent text-sm text-foreground outline-none"
                                value={draft.maxPositionPctOverride}
                                onChange={(event) => updateDraft(policy.id, { maxPositionPctOverride: event.target.value })}
                                placeholder="0.25"
                              />
                            </label>
                          </div>
                          <label className="mt-2 block rounded-lg border border-border px-3 py-2 text-xs text-muted">
                            <span className="mb-1 block">Notes</span>
                            <textarea
                              className="min-h-20 w-full resize-y bg-transparent text-sm text-foreground outline-none"
                              value={draft.notes}
                              onChange={(event) => updateDraft(policy.id, { notes: event.target.value })}
                              placeholder="Optional notes for future review"
                            />
                          </label>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-xs text-muted">
                              Override value: {policy.recommendation_status_override ?? "none"} · Updated {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : "—"}
                            </p>
                            <button
                              type="button"
                              className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950"
                              disabled={savingPolicyId === policy.id}
                              onClick={() => void onSavePolicy(entry.token.id, policy)}
                            >
                              {savingPolicyId === policy.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <section className="oz-panel space-y-3 p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Enforcement Verification</p>
          <p className="text-xs text-muted">Recent strategy, risk, and execution decisions pulled from persisted live-path records.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
            placeholder="Token"
            value={filters.symbol}
            onChange={(event) => setFilters((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
          />
          <select
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
            value={filters.strategy_id}
            onChange={(event) => setFilters((current) => ({ ...current, strategy_id: event.target.value }))}
          >
            <option value="">All strategies</option>
            {strategyOptions.map((strategyId) => (
              <option key={strategyId} value={strategyId}>
                {strategyId}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
            value={filters.trading_mode}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                trading_mode: event.target.value as DecisionFilterState["trading_mode"],
              }))
            }
          >
            <option value="">All modes</option>
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
          <select
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
            value={filters.outcome}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                outcome: event.target.value as DecisionFilterState["outcome"],
              }))
            }
          >
            <option value="">All outcomes</option>
            <option value="emitted">Emitted</option>
            <option value="reduced">Reduced</option>
            <option value="rejected">Rejected</option>
            <option value="executed">Executed</option>
          </select>
        </div>
        {decisionStatus ? <p className="text-xs text-muted">{decisionStatus}</p> : null}
        {loadingDecisions ? (
          Array.from({ length: 3 }).map((_, index) => <RowSkeleton key={`decision-skeleton-${index}`} />)
        ) : decisions.length === 0 ? (
          <p className="text-sm text-muted">No enforcement records match the current filters.</p>
        ) : (
          <div className="space-y-2">
            {decisions.map((decision) => (
              <article key={decision.record_id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface px-2 py-1 text-[11px] font-semibold text-muted">
                    {decision.enforced_in}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${outcomeTone(decision.decision_outcome)}`}>
                    {decision.decision_outcome}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(decision.effective_recommendation_status)}`}>
                    {decision.effective_recommendation_status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {decision.strategy_name} · {decision.token} · {decision.trading_mode}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Computed {decision.computed_recommendation_status} · admin enabled {decision.admin_enabled ? "yes" : "no"} · confidence{" "}
                  {decision.confidence_score == null ? "—" : decision.confidence_score.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Size {decision.final_sizing_impact.original_size ?? "—"} → {decision.final_sizing_impact.final_size ?? "—"} · multiplier{" "}
                  {decision.final_sizing_impact.size_multiplier ?? "—"} · max override{" "}
                  {decision.final_sizing_impact.max_position_pct_override ?? "—"}
                </p>
                <p className="mt-2 text-xs text-muted">{decision.decision_reason ?? "No decision reason recorded."}</p>
                <p className="mt-2 text-[11px] text-muted">{new Date(decision.timestamp).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
