"use client";

import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { downloadTradingPerformanceCsv } from "@/lib/trading-export-api";

const LIMIT_PRESETS = [100, 250, 500, 1000] as const;

export default function TradingPerformanceExportPage() {
  const { mode } = useTradingMode();
  const [limit, setLimit] = useState<number>(100);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <AppShell
      title="Export trade outcomes"
      subtitle="Download your recent closed-trade features as a CSV file for spreadsheets or backup. Data respects the trading mode shown in the header / drawer."
    >
      <div className="oz-panel border-border bg-card/60 p-4 sm:p-5">
        <p className="text-sm text-muted">
          The export includes the same columns as the server report: trade id, strategy, token, mode, prices,
          times, size, PnL, fees, exit reason, and excursion fields.
        </p>

        <div className="mt-6 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="limit">
            Row limit (max 5000)
          </label>
          <div className="flex flex-wrap gap-2">
            {LIMIT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  limit === n
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            id="limit"
            type="number"
            min={1}
            max={5000}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 100)}
            className="mt-2 w-full max-w-xs rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMessage(null);
            setBusy(true);
            void (async () => {
              const clamped = Math.min(5000, Math.max(1, Math.floor(Number(limit)) || 100));
              const result = await downloadTradingPerformanceCsv(mode, { limit: clamped });
              setBusy(false);
              if (result.ok) {
                setMessage("Download started — check your downloads folder.");
              } else {
                setMessage(result.message);
              }
            })();
          }}
          className="mt-8 flex h-12 w-full max-w-sm items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Preparing…" : `Download CSV (${mode})`}
        </button>

        {message ? (
          <p
            className={`mt-4 text-sm ${message.includes("folder") ? "text-positive" : "text-negative"}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
