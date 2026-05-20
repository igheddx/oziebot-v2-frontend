"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
import { fetchUserTokenPolicyMatrix, type TokenPolicyMatrixEntry } from "@/lib/admin-token-policy";
import { getTokens } from "@/lib/dashboard-api";
import type { TokenItem } from "@/lib/dashboard-types";
import { RowSkeleton } from "@/components/ui/skeleton";

type AdminToken = {
  id: string;
  symbol: string;
  quote_currency: string;
  network: string;
  display_name: string | null;
  is_enabled: boolean;
  sort_order: number;
};

type ConfiguredStrategy = {
  strategy_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
};

function getConfigSymbols(config: Record<string, unknown> | null | undefined): string[] {
  const requested = config?.symbols;
  if (!Array.isArray(requested)) return [];
  return requested
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
}

function formatReasonLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

export default function TokensPage() {
  const { mode } = useTradingMode();
  const { role } = useAuth();
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingToken, setTogglingToken] = useState<string | null>(null);
  const [adminTokens, setAdminTokens] = useState<AdminToken[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [network, setNetwork] = useState("coinbase");
  const [displayName, setDisplayName] = useState("");
  const [policyMatrix, setPolicyMatrix] = useState<TokenPolicyMatrixEntry[]>([]);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [configuredStrategies, setConfiguredStrategies] = useState<Record<string, ConfiguredStrategy>>({});

  const loadUserTokens = useCallback(async () => {
    setIsLoading(true);
    const rows = await getTokens(mode);
    setTokens(rows);
    setIsLoading(false);
  }, [mode]);

  useEffect(() => {
    void loadUserTokens();
  }, [loadUserTokens]);

  const loadConfiguredStrategies = useCallback(async () => {
    const res = await authFetch("/v1/me/strategies");
    if (!res || !res.ok) {
      setConfiguredStrategies({});
      return;
    }
    const payload = (await res.json()) as { strategies: ConfiguredStrategy[] };
    const next = Object.fromEntries(
      (payload.strategies ?? []).map((strategy) => [strategy.strategy_id, strategy]),
    );
    setConfiguredStrategies(next);
  }, []);

  const isRootAdmin = role === "root_admin";

  const loadAdminTokens = useCallback(async () => {
    if (!isRootAdmin) return;
    setAdminLoading(true);
    const res = await authFetch("/v1/admin/platform/tokens");
    if (!res) {
      setAdminStatus("Could not reach API.");
      setAdminLoading(false);
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      setAdminLoading(false);
      return;
    }
    const rows = (await res.json()) as AdminToken[];
    setAdminTokens(rows);
    setAdminLoading(false);
  }, [isRootAdmin]);

  useEffect(() => {
    loadAdminTokens();
  }, [loadAdminTokens]);

  const loadPolicyMatrix = useCallback(async () => {
    setPolicyLoading(true);
    const response = await fetchUserTokenPolicyMatrix();
    setPolicyLoading(false);
    if (response.data) {
      setPolicyMatrix(response.data);
    }
  }, []);

  useEffect(() => {
    void loadPolicyMatrix();
  }, [loadPolicyMatrix]);

  useEffect(() => {
    void loadConfiguredStrategies();
  }, [loadConfiguredStrategies]);

  const onCreateToken = async () => {
    setAdminStatus(null);
    if (!symbol.trim()) {
      setAdminStatus("Symbol is required.");
      return;
    }
    const res = await authFetch("/v1/admin/platform/tokens", {
      method: "POST",
      body: JSON.stringify({
        symbol: symbol.trim(),
        quote_currency: quoteCurrency.trim().toUpperCase(),
        network: network.trim() || "coinbase",
        display_name: displayName.trim() || null,
        is_enabled: true,
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
    setSymbol("");
    setDisplayName("");
    setAdminStatus("Token added.");
    await loadAdminTokens();
  };

  const toggleUserToken = async (token: TokenItem) => {
    setTogglingToken(token.id);
    const action = token.enabled ? "disable" : "enable";
    const res = await authFetch(`/v1/me/tokens/${token.id}/${action}`, { method: "POST" });
    setTogglingToken(null);
    if (!res || !res.ok) return;
    await Promise.all([loadUserTokens(), loadPolicyMatrix()]);
  };

  const toggleAdminToken = async (token: AdminToken) => {
    setAdminStatus(null);
    const res = await authFetch(`/v1/admin/platform/tokens/${token.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_enabled: !token.is_enabled }),
    });
    if (!res) {
      setAdminStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      return;
    }
    await Promise.all([loadAdminTokens(), loadPolicyMatrix(), loadUserTokens()]);
  };

  const tokenEnabledById = useMemo(
    () => new Map(tokens.map((token) => [token.id, token.enabled])),
    [tokens],
  );

  const matrixSummary = useMemo(() => {
    let blockedPairs = 0;
    let discouragedPairs = 0;
    let tradablePairs = 0;
    let assignedPairs = 0;
    for (const entry of policyMatrix) {
      for (const policy of entry.strategy_policies) {
        const configured = configuredStrategies[policy.strategy_id];
        const selectedSymbols = getConfigSymbols(configured?.config);
        const assigned =
          selectedSymbols.length === 0 || selectedSymbols.includes(entry.token.symbol.toUpperCase());
        if (assigned) assignedPairs += 1;
        if (!policy.is_enabled || !assigned || !configured?.is_enabled) continue;
        if (!entry.platform_token_enabled || !entry.user_token_enabled) continue;
        if (policy.effective_recommendation_status === "blocked") blockedPairs += 1;
        else if (policy.effective_recommendation_status === "discouraged") discouragedPairs += 1;
        else tradablePairs += 1;
      }
    }
    return {
      enabledTokens: tokens.filter((token) => token.enabled).length,
      totalTokens: tokens.length,
      blockedPairs,
      discouragedPairs,
      tradablePairs,
      assignedPairs,
    };
  }, [configuredStrategies, policyMatrix, tokens]);

  return (
    <AppShell title="Token Selection" subtitle="Allowlist is scoped to selected trading mode.">
      {isRootAdmin ? (
        <section className="oz-panel space-y-3 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Root Admin: Platform Tokens</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Symbol (e.g. SOL-USD)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Quote"
              value={quoteCurrency}
              onChange={(e) => setQuoteCurrency(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Network"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="h-10 rounded-lg bg-amber-400 px-3 text-sm font-semibold text-slate-950"
            onClick={onCreateToken}
          >
            Add Token
          </button>
          {adminStatus ? <p className="text-xs text-muted">{adminStatus}</p> : null}

          <div className="space-y-2">
            {adminLoading ? (
              <RowSkeleton />
            ) : (
              adminTokens.map((token) => (
                <article key={token.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <p className="text-xs text-muted">
                    {token.symbol} · {token.quote_currency} · {token.network}
                  </p>
                  <button
                    type="button"
                    className={`h-8 rounded-lg px-2 text-xs font-semibold ${
                      token.is_enabled ? "bg-positive/20 text-positive" : "bg-surface text-muted"
                    }`}
                    onClick={() => toggleAdminToken(token)}
                  >
                    {token.is_enabled ? "Enabled" : "Disabled"}
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="oz-panel p-3">
        <p className="text-xs text-muted">
          Current mode token policy: <span className="font-semibold uppercase text-foreground">{mode}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="uppercase tracking-wide text-muted">Enabled tokens</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {matrixSummary.enabledTokens}/{matrixSummary.totalTokens}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="uppercase tracking-wide text-muted">Tradable pairs</p>
            <p className="mt-1 text-sm font-semibold text-positive">{matrixSummary.tradablePairs}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="uppercase tracking-wide text-muted">Discouraged pairs</p>
            <p className="mt-1 text-sm font-semibold text-amber-300">{matrixSummary.discouragedPairs}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="uppercase tracking-wide text-muted">Blocked pairs</p>
            <p className="mt-1 text-sm font-semibold text-negative">{matrixSummary.blockedPairs}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          A token can be globally enabled and still not trade if the strategy is off, the token is not assigned to that strategy, or admin policy marks the pair blocked/discouraged.
        </p>
      </section>

      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, idx) => <RowSkeleton key={`token-skeleton-${idx}`} />)
          : tokens.length === 0
            ? (
              <section className="oz-panel p-3 text-sm text-muted">No tokens available for this trading mode.</section>
            )
          : tokens.map((token) => (
          <article key={token.id} className="oz-panel flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-semibold">
                {token.symbol}-{token.quote}
              </p>
              <p className="text-xs text-muted">
                {token.name} · Volatility {token.volatility}
              </p>
            </div>
            <button
              type="button"
              disabled={togglingToken === token.id}
              onClick={() => toggleUserToken(token)}
              className={`h-9 rounded-lg px-3 text-xs font-semibold transition-opacity disabled:opacity-50 ${
                token.enabled ? "bg-positive/20 text-positive" : "bg-surface text-muted"
              }`}
            >
              {togglingToken === token.id ? "…" : token.enabled ? "Enabled" : "Disabled"}
            </button>
          </article>
        ))}
      </div>

      <section className="oz-panel space-y-3 p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Token Strategy Eligibility</p>
          <p className="text-xs text-muted">
            This matrix shows the final effective tradeability for each token/strategy pair after global enablement, strategy assignment, strategy toggle, and admin policy are combined.
          </p>
        </div>
        {policyLoading ? (
          <RowSkeleton />
        ) : policyMatrix.length === 0 ? (
          <p className="text-sm text-muted">No token-strategy policy rows available yet.</p>
        ) : (
          <div className="space-y-3">
            {policyMatrix.map((entry) => (
              <article key={entry.token.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{entry.token.symbol}</p>
                    <p className="text-xs text-muted">
                      Platform {entry.platform_token_enabled ? "enabled" : "disabled"} · You{" "}
                      {tokenEnabledById.get(entry.token.id) ?? entry.user_token_enabled ? "enabled" : "disabled"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-border bg-card px-2 py-1 text-muted">
                      Assignments {entry.strategy_policies.length}
                    </span>
                    <span className="rounded-full border border-positive/40 bg-positive/15 px-2 py-1 text-positive">
                      Active{" "}
                      {
                        entry.strategy_policies.filter(
                          (policy) =>
                            policy.is_enabled &&
                            policy.effective_recommendation_status !== "blocked",
                        ).length
                      }
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {entry.strategy_policies.map((policy) => {
                    const userStrategy = entry.strategies?.find((row) => row.strategy_id === policy.strategy_id);
                    const configured = configuredStrategies[policy.strategy_id];
                    const configuredSymbols = getConfigSymbols(configured?.config);
                    const assignmentState =
                      configuredSymbols.length === 0
                        ? "uses_all_enabled_tokens"
                        : configuredSymbols.includes(entry.token.symbol.toUpperCase())
                          ? "assigned"
                          : "not_assigned";
                    const strategyEnabled = Boolean(userStrategy?.is_user_enabled ?? configured?.is_enabled);
                    const effectiveAction =
                      !entry.platform_token_enabled || !(tokenEnabledById.get(entry.token.id) ?? entry.user_token_enabled)
                        ? "token_disabled"
                        : !strategyEnabled
                          ? "strategy_disabled"
                          : assignmentState === "not_assigned"
                            ? "not_assigned"
                            : !policy.is_enabled
                              ? "pair_disabled"
                              : policy.effective_recommendation_status === "blocked"
                                ? "blocked"
                                : policy.effective_recommendation_status === "discouraged"
                                  ? "discouraged"
                                  : "tradable";
                    return (
                      <div key={`${entry.token.id}-${policy.strategy_id}`} className="rounded-lg bg-surface p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{policy.strategy_display_name ?? policy.strategy_id}</p>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              policy.effective_recommendation_status === "blocked"
                                ? "bg-negative/15 text-negative"
                                : policy.effective_recommendation_status === "discouraged"
                                  ? "bg-amber-400/20 text-amber-300"
                                  : policy.effective_recommendation_status === "preferred"
                                    ? "bg-positive/15 text-positive"
                                    : "bg-card text-muted"
                            }`}
                          >
                            {policy.effective_recommendation_status}
                          </span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              effectiveAction === "tradable"
                                ? "bg-positive/15 text-positive"
                                : effectiveAction === "discouraged"
                                  ? "bg-amber-400/20 text-amber-300"
                                  : "bg-negative/15 text-negative"
                            }`}
                          >
                            {formatReasonLabel(effectiveAction)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-4">
                          <div className="rounded-lg border border-border bg-card px-2 py-2">
                            <p className="uppercase tracking-wide text-muted/80">Global token</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {entry.platform_token_enabled && (tokenEnabledById.get(entry.token.id) ?? entry.user_token_enabled)
                                ? "Enabled"
                                : "Disabled"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-card px-2 py-2">
                            <p className="uppercase tracking-wide text-muted/80">Strategy</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {strategyEnabled ? "Enabled" : "Disabled"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-card px-2 py-2">
                            <p className="uppercase tracking-wide text-muted/80">Assignment</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {formatReasonLabel(assignmentState)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-card px-2 py-2">
                            <p className="uppercase tracking-wide text-muted/80">Pair policy</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {policy.is_enabled ? "Enabled" : "Disabled"}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          Size multiplier {policy.size_multiplier.toFixed(2)} · Recommendation{" "}
                          {formatReasonLabel(policy.effective_recommendation_status)}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {policy.effective_recommendation_reason ??
                            policy.recommendation_reason ??
                            "No policy note recorded."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
