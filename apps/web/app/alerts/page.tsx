"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { authFetch } from "@/lib/auth-service";
import { RowSkeleton } from "@/components/ui/skeleton";

type Channel = "sms" | "slack" | "telegram";
type TradingModeFilter = "paper" | "live" | "all";

type ChannelConfig = {
  id: string;
  channel: Channel;
  destination: string;
  is_enabled: boolean;
};

type EventPreference = {
  id: string;
  event_type: string;
  trading_mode: TradingModeFilter;
  is_enabled: boolean;
};

type AlertsConfig = {
  channels: ChannelConfig[];
  preferences: EventPreference[];
  supported_channels: Channel[];
  supported_event_types: string[];
};

const CHANNEL_META: Record<Channel, { label: string; placeholder: string }> = {
  sms: { label: "SMS", placeholder: "+1 555 000 0000" },
  slack: { label: "Slack Webhook", placeholder: "https://hooks.slack.com/services/..." },
  telegram: { label: "Telegram", placeholder: "Chat ID or bot token" },
};

const EVENT_LABELS: Record<string, string> = {
  trade_opened: "Trade Opened",
  trade_closed: "Trade Closed",
  stop_loss_hit: "Stop Loss Hit",
  take_profit_hit: "Take Profit Hit",
  strategy_paused: "Strategy Paused",
  coinbase_connection_issue: "Coinbase Issue",
  insufficient_balance: "Insufficient Balance",
  daily_summary: "Daily Summary",
};

export default function AlertsPage() {
  const { mode } = useTradingMode();
  const [config, setConfig] = useState<AlertsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [channelDest, setChannelDest] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    const res = await authFetch("/v1/me/alerts/config");
    setIsLoading(false);
    if (!res || !res.ok) return;
    setConfig((await res.json()) as AlertsConfig);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveChannel = async (channel: Channel, destination: string, enabled: boolean) => {
    setSaving(`ch-${channel}`);
    await authFetch(`/v1/me/alerts/channels/${channel}`, {
      method: "PUT",
      body: JSON.stringify({ destination, is_enabled: enabled }),
    });
    setSaving(null);
    setEditingChannel(null);
    loadConfig();
  };

  const togglePreference = async (eventType: string, currentEnabled: boolean) => {
    setSaving(`pref-${eventType}`);
    await authFetch(`/v1/me/alerts/preferences/${eventType}`, {
      method: "PUT",
      body: JSON.stringify({ trading_mode: mode, is_enabled: !currentEnabled }),
    });
    setSaving(null);
    loadConfig();
  };

  if (isLoading) {
    return (
      <AppShell title="Alerts Configuration" subtitle="Notification routing and risk alerts scoped by current mode.">
        {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={`sk-${i}`} />)}
      </AppShell>
    );
  }

  const supportedChannels = config?.supported_channels ?? (["sms", "slack", "telegram"] as Channel[]);
  const supportedEvents = config?.supported_event_types ?? [];
  const channelMap = new Map((config?.channels ?? []).map((c) => [c.channel, c]));
  const prefMap = new Map(
    (config?.preferences ?? [])
      .filter((p) => p.trading_mode === (mode as TradingModeFilter) || p.trading_mode === "all")
      .map((p) => [p.event_type, p]),
  );

  return (
    <AppShell title="Alerts Configuration" subtitle="Notification routing and risk alerts scoped by current mode.">
      <section className="oz-panel space-y-3 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notification Channels</p>
        {supportedChannels.map((channel) => {
          const cfg = channelMap.get(channel);
          const meta = CHANNEL_META[channel];
          const isEditing = editingChannel === channel;
          const isSaving = saving === `ch-${channel}`;
          return (
            <div key={channel} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{meta.label}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        setEditingChannel(null);
                      } else {
                        setEditingChannel(channel);
                        setChannelDest(cfg?.destination ?? "");
                      }
                    }}
                    className="h-7 rounded-lg bg-surface px-2 text-xs text-muted"
                  >
                    {isEditing ? "Cancel" : "Configure"}
                  </button>
                  {cfg ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => saveChannel(channel, cfg.destination, !cfg.is_enabled)}
                      className={`h-7 rounded-lg px-2 text-xs font-semibold disabled:opacity-50 ${cfg.is_enabled ? "bg-positive/20 text-positive" : "bg-surface text-muted"}`}
                    >
                      {isSaving ? "…" : cfg.is_enabled ? "ON" : "OFF"}
                    </button>
                  ) : (
                    <span className="h-7 rounded-lg bg-surface px-2 text-xs leading-7 text-muted">Not set up</span>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
                    placeholder={meta.placeholder}
                    value={channelDest}
                    onChange={(e) => setChannelDest(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!channelDest.trim() || isSaving}
                    onClick={() => saveChannel(channel, channelDest, cfg?.is_enabled ?? true)}
                    className="h-9 rounded-lg bg-sky-500 px-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isSaving ? "…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="oz-panel space-y-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Event Preferences · <span className="uppercase">{mode}</span>
        </p>
        {supportedEvents.length === 0 ? (
          <p className="text-xs text-muted">No event types available.</p>
        ) : (
          supportedEvents.map((eventType) => {
            const pref = prefMap.get(eventType);
            const isEnabled = pref?.is_enabled ?? false;
            const isSaving = saving === `pref-${eventType}`;
            return (
              <div key={eventType} className="flex items-center justify-between rounded-lg border border-border p-2">
                <p className="text-sm">{EVENT_LABELS[eventType] ?? eventType}</p>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => togglePreference(eventType, isEnabled)}
                  className={`h-7 rounded-lg px-2 text-xs font-semibold disabled:opacity-50 ${isEnabled ? "bg-positive/20 text-positive" : "bg-surface text-muted"}`}
                >
                  {isSaving ? "…" : isEnabled ? "ON" : "OFF"}
                </button>
              </div>
            );
          })
        )}
      </section>
    </AppShell>
  );
}
