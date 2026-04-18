"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { RowSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchFeeSettings, saveFeeSettings, type FeeSettings } from "@/lib/admin-fee-settings";

type DraftState = {
  paperMakerFeeBps: string;
  paperTakerFeeBps: string;
  liveMakerFeeBps: string;
  liveTakerFeeBps: string;
  estimatedSlippageBps: string;
  spreadBufferBps: string;
  safetyBufferBps: string;
  minNotionalPerTrade: string;
  minExpectedEdgeBps: string;
  minExpectedNetProfitDollars: string;
  maxFeePercentOfExpectedProfit: string;
  makerTimeoutSeconds: string;
  limitPriceOffsetBps: string;
  maxSlippageBps: string;
  executionPreference: "maker_preferred" | "taker_allowed" | "taker_only";
  fallbackBehavior: "cancel" | "reprice" | "convert_to_taker";
  skipTradeIfFeeTooHigh: boolean;
  strategyOverridesJson: string;
  symbolOverridesJson: string;
};

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function buildDraft(settings: FeeSettings): DraftState {
  const paper = (settings.paper as Record<string, unknown> | undefined) ?? {};
  const live = (settings.live as Record<string, unknown> | undefined) ?? {};
  const defaults = (settings.defaults as Record<string, unknown> | undefined) ?? {};
  return {
    paperMakerFeeBps: String(paper.maker_fee_bps ?? 40),
    paperTakerFeeBps: String(paper.taker_fee_bps ?? 60),
    liveMakerFeeBps: String(live.maker_fee_bps ?? 40),
    liveTakerFeeBps: String(live.taker_fee_bps ?? 60),
    estimatedSlippageBps: String(live.estimated_slippage_bps ?? 12),
    spreadBufferBps: String(live.spread_buffer_bps ?? 4),
    safetyBufferBps: String(live.safety_buffer_bps ?? 8),
    minNotionalPerTrade: String(defaults.min_notional_per_trade ?? 25),
    minExpectedEdgeBps: String(defaults.min_expected_edge_bps ?? 25),
    minExpectedNetProfitDollars: String(defaults.min_expected_net_profit_dollars ?? 0.5),
    maxFeePercentOfExpectedProfit: String(defaults.max_fee_percent_of_expected_profit ?? 0.65),
    makerTimeoutSeconds: String(defaults.maker_timeout_seconds ?? 15),
    limitPriceOffsetBps: String(defaults.limit_price_offset_bps ?? 2),
    maxSlippageBps: String(defaults.max_slippage_bps ?? 35),
    executionPreference:
      (defaults.execution_preference as DraftState["executionPreference"] | undefined) ??
      "maker_preferred",
    fallbackBehavior:
      (defaults.fallback_behavior as DraftState["fallbackBehavior"] | undefined) ??
      "convert_to_taker",
    skipTradeIfFeeTooHigh: Boolean(defaults.skip_trade_if_fee_too_high ?? true),
    strategyOverridesJson: stringifyJson(settings.strategy_overrides),
    symbolOverridesJson: stringifyJson(settings.symbol_overrides),
  };
}

export default function AdminFeeSettingsPage() {
  const { role } = useAuth();
  const isRootAdmin = role === "root_admin";
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isRootAdmin) return;
    setLoading(true);
    const response = await fetchFeeSettings();
    setLoading(false);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    const next = response.data ?? {};
    setSettings(next);
    setDraft(buildDraft(next));
    setStatus(null);
  }, [isRootAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(() => {
    if (!draft) return null;
    try {
      return {
        enabled: true,
        paper: {
          maker_fee_bps: Number(draft.paperMakerFeeBps),
          taker_fee_bps: Number(draft.paperTakerFeeBps),
          estimated_slippage_bps: Number(draft.estimatedSlippageBps),
          spread_buffer_bps: Number(draft.spreadBufferBps),
          safety_buffer_bps: Number(draft.safetyBufferBps),
        },
        live: {
          maker_fee_bps: Number(draft.liveMakerFeeBps),
          taker_fee_bps: Number(draft.liveTakerFeeBps),
          estimated_slippage_bps: Number(draft.estimatedSlippageBps),
          spread_buffer_bps: Number(draft.spreadBufferBps),
          safety_buffer_bps: Number(draft.safetyBufferBps),
        },
        defaults: {
          execution_preference: draft.executionPreference,
          fallback_behavior: draft.fallbackBehavior,
          min_notional_per_trade: Number(draft.minNotionalPerTrade),
          min_expected_edge_bps: Number(draft.minExpectedEdgeBps),
          min_expected_net_profit_dollars: Number(draft.minExpectedNetProfitDollars),
          max_fee_percent_of_expected_profit: Number(draft.maxFeePercentOfExpectedProfit),
          maker_timeout_seconds: Number(draft.makerTimeoutSeconds),
          limit_price_offset_bps: Number(draft.limitPriceOffsetBps),
          max_slippage_bps: Number(draft.maxSlippageBps),
          skip_trade_if_fee_too_high: draft.skipTradeIfFeeTooHigh,
        },
        strategy_overrides: JSON.parse(draft.strategyOverridesJson),
        symbol_overrides: JSON.parse(draft.symbolOverridesJson),
      };
    } catch {
      return null;
    }
  }, [draft]);

  const updateDraft = (patch: Partial<DraftState>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const onSave = async () => {
    if (!preview) {
      setStatus("Strategy overrides and symbol overrides must be valid JSON objects.");
      return;
    }
    setSaving(true);
    const response = await saveFeeSettings(preview);
    setSaving(false);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    setSettings(response.data?.value ?? preview);
    setDraft(buildDraft(response.data?.value ?? preview));
    setStatus("Fee settings saved.");
  };

  if (!isRootAdmin) {
    return (
      <AppShell title="Fee Settings" subtitle="Root admin access is required.">
        <section className="oz-panel p-4 text-sm text-muted">
          This screen is only available to root admins because it controls execution cost filters.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Fee Settings"
      subtitle="Configure Coinbase fee assumptions, maker fallback behavior, and platform-wide trade economics."
      showModeToggle={false}
    >
      {loading || !draft ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : (
        <>
          <section className="oz-panel space-y-3 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Execution Costs</p>
                <p className="text-xs text-muted">Paper/live fee assumptions and platform-level fee filters.</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
                onClick={() => void load()}
              >
                Refresh
              </button>
            </div>
            {status ? <p className="text-xs text-muted">{status}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Paper maker fee (bps)", "paperMakerFeeBps"],
                ["Paper taker fee (bps)", "paperTakerFeeBps"],
                ["Live maker fee (bps)", "liveMakerFeeBps"],
                ["Live taker fee (bps)", "liveTakerFeeBps"],
                ["Estimated slippage (bps)", "estimatedSlippageBps"],
                ["Spread buffer (bps)", "spreadBufferBps"],
                ["Safety buffer (bps)", "safetyBufferBps"],
                ["Min notional ($)", "minNotionalPerTrade"],
                ["Min expected edge (bps)", "minExpectedEdgeBps"],
                ["Min net profit ($)", "minExpectedNetProfitDollars"],
                ["Max fee % of profit", "maxFeePercentOfExpectedProfit"],
                ["Maker timeout (sec)", "makerTimeoutSeconds"],
                ["Limit offset (bps)", "limitPriceOffsetBps"],
                ["Max slippage (bps)", "maxSlippageBps"],
              ].map(([label, key]) => (
                <label key={key} className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                  <span className="mb-1 block">{label}</span>
                  <input
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                    value={draft[key as keyof DraftState] as string}
                    onChange={(event) =>
                      updateDraft({ [key]: event.target.value } as Partial<DraftState>)
                    }
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                <span className="mb-1 block">Execution preference</span>
                <select
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                  value={draft.executionPreference}
                  onChange={(event) =>
                    updateDraft({
                      executionPreference: event.target.value as DraftState["executionPreference"],
                    })
                  }
                >
                  <option value="maker_preferred">maker_preferred</option>
                  <option value="taker_allowed">taker_allowed</option>
                  <option value="taker_only">taker_only</option>
                </select>
              </label>
              <label className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                <span className="mb-1 block">Fallback behavior</span>
                <select
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                  value={draft.fallbackBehavior}
                  onChange={(event) =>
                    updateDraft({
                      fallbackBehavior: event.target.value as DraftState["fallbackBehavior"],
                    })
                  }
                >
                  <option value="cancel">cancel</option>
                  <option value="reprice">reprice</option>
                  <option value="convert_to_taker">convert_to_taker</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.skipTradeIfFeeTooHigh}
                onChange={(event) =>
                  updateDraft({ skipTradeIfFeeTooHigh: event.target.checked })
                }
              />
              Skip trade if fee too high
            </label>
          </section>

          <section className="oz-panel space-y-3 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Strategy Overrides</p>
            <textarea
              className="min-h-40 w-full rounded-xl border border-border bg-card p-3 font-mono text-xs text-foreground outline-none"
              value={draft.strategyOverridesJson}
              onChange={(event) => updateDraft({ strategyOverridesJson: event.target.value })}
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Symbol Overrides</p>
            <textarea
              className="min-h-40 w-full rounded-xl border border-border bg-card p-3 font-mono text-xs text-foreground outline-none"
              value={draft.symbolOverridesJson}
              onChange={(event) => updateDraft({ symbolOverridesJson: event.target.value })}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground"
                disabled={saving}
                onClick={() => void onSave()}
              >
                {saving ? "Saving..." : "Save fee settings"}
              </button>
            </div>
          </section>

          <section className="oz-panel p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current Preview</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-surface p-3 text-[11px] text-muted">
              {JSON.stringify(preview ?? settings, null, 2)}
            </pre>
          </section>
        </>
      )}
    </AppShell>
  );
}
