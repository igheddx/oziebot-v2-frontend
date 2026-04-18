"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { RowSkeleton } from "@/components/ui/skeleton";
import { getCoinbaseConnection, upsertCoinbaseConnection } from "@/lib/dashboard-api";
import type { CoinbaseConnection } from "@/lib/dashboard-types";

export default function CoinbasePage() {
  const { mode } = useTradingMode();
  const [connection, setConnection] = useState<CoinbaseConnection | null>(null);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiSecretPem, setApiSecretPem] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getCoinbaseConnection(mode).then((data) => {
      if (mounted) setConnection(data);
    });
    return () => {
      mounted = false;
    };
  }, [mode]);

  const onSave = async () => {
    setStatus(null);
    if (!apiKeyName.trim() || !apiSecretPem.trim()) {
      setStatus("Enter both API Key Name and API Secret PEM.");
      return;
    }

    setIsSaving(true);
    const result = await upsertCoinbaseConnection(mode, apiKeyName.trim(), apiSecretPem.trim());
    setIsSaving(false);

    if (result.connection) {
      setConnection(result.connection);
      setStatus("Saved and validated successfully.");
      return;
    }
    setStatus(result.error ?? "Could not save Coinbase connection.");
  };

  return (
    <AppShell title="Coinbase Connection" subtitle="LIVE mode uses this connection. PAPER mode never calls exchange APIs.">
      {!connection ? (
        <RowSkeleton />
      ) : (
        <section className="oz-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Connection Status</h2>
          <p
            className={`mt-2 text-lg font-semibold ${
              connection.healthStatus === "healthy" ? "text-positive" : "text-negative"
            }`}
          >
            {(connection.healthStatus ?? "unknown").toUpperCase()}
          </p>
          <p className="text-sm text-muted">
            {connection.apiKeyNameMasked} · {connection.validationStatus}
          </p>
          <p className="text-xs text-muted">
            trade {String(connection.canTrade)} · balances {String(connection.canReadBalances)}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs text-muted">
          Saved credentials are encrypted at rest and are never shown again. Re-enter key/secret only when rotating.
        </p>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">API Key Name</label>
        <input
          className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
          placeholder="organizations/.../apiKeys/..."
          value={apiKeyName}
          onChange={(e) => setApiKeyName(e.target.value)}
        />
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">API Secret PEM</label>
        <textarea
          className="h-36 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-sky-400"
          placeholder="-----BEGIN EC PRIVATE KEY-----"
          value={apiSecretPem}
          onChange={(e) => setApiSecretPem(e.target.value)}
        />
        <button
          className="h-12 w-full rounded-xl bg-sky-500 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Validate & Save"}
        </button>
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </section>
    </AppShell>
  );
}
