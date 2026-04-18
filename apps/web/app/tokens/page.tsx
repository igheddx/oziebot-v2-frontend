"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
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

  const loadUserTokens = useCallback(() => {
    setIsLoading(true);
    getTokens(mode)
      .then((rows) => setTokens(rows))
      .finally(() => setIsLoading(false));
  }, [mode]);

  useEffect(() => {
    loadUserTokens();
  }, [loadUserTokens]);

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
    loadUserTokens();
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
    await loadAdminTokens();
  };

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
    </AppShell>
  );
}
