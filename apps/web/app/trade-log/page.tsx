"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";

type TradeLogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TradeLogValue[]
  | { [key: string]: TradeLogValue };

type TradeLogEvent = {
  timestamp: string;
  symbol: string;
  event_type: string;
  message: string;
  source?: string;
  details?: Record<string, TradeLogValue>;
};

type MarketState = {
  trend: string;
  volatility: string;
  liquidity: string;
  trade_bias: string;
};

type TradeLogSummary = {
  timestamp: string;
  symbol: string;
  summary_line: string;
  market_state: MarketState;
  signal_quality_score: number | string;
  signal_quality_label: string;
  raw_metrics?: Record<string, TradeLogValue>;
};

type TradeLogPayload = {
  events: TradeLogEvent[];
  summaries: TradeLogSummary[];
  count: number;
  available_symbols: string[];
  available_event_types: string[];
};

type VisibilityMode = "all" | "raw" | "enriched";
type ViewMode = "compact" | "expanded";

const POLL_MS = 4000;
const RAW_EVENT_TYPES = new Set(["bbo_update", "trade_tick"]);
const ENRICHED_EVENT_TYPES = new Set(["market_snapshot", "derived_signal", "strategy_evaluation"]);

function formatLabel(key: string) {
  return key.replaceAll("_", " ");
}

function toNumber(value: number | string | undefined | null) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMetric(value: TradeLogValue): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (value == null) return "n/a";
  if (Array.isArray(value)) return value.map((item) => formatMetric(item)).join(", ");
  return "";
}

function eventTone(event: TradeLogEvent) {
  const state = event.details?.market_state;
  const tradeBias =
    state && !Array.isArray(state) && typeof state === "object" ? String(state.trade_bias ?? "") : "";
  const message = event.message.toUpperCase();
  if (tradeBias === "BUY" || message.includes(" TREND: UP") || message.includes(" BUY")) {
    return "green";
  }
  if (tradeBias === "SELL" || message.includes(" TREND: DOWN") || message.includes(" SELL")) {
    return "red";
  }
  return "yellow";
}

function isVisibleEvent(event: TradeLogEvent, visibilityMode: VisibilityMode) {
  if (visibilityMode === "all") return true;
  if (visibilityMode === "raw") return RAW_EVENT_TYPES.has(event.event_type);
  return ENRICHED_EVENT_TYPES.has(event.event_type);
}

function DetailList({
  value,
  depth = 0,
}: {
  value: Record<string, TradeLogValue> | TradeLogValue[];
  depth?: number;
}) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <span
            key={`${depth}-${index}`}
            className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/80"
          >
            {typeof item === "object" && item !== null ? JSON.stringify(item) : formatMetric(item)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(value).map(([key, entry]) => {
        const nested = typeof entry === "object" && entry !== null;
        return (
          <div
            key={`${depth}-${key}`}
            className="rounded-2xl border border-white/8 bg-black/30 px-3 py-2"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/60">{formatLabel(key)}</p>
            <div className="mt-1 text-xs text-white/85">
              {nested ? (
                <DetailList value={entry as Record<string, TradeLogValue> | TradeLogValue[]} depth={depth + 1} />
              ) : (
                formatMetric(entry)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ summary }: { summary: TradeLogSummary }) {
  const score = toNumber(summary.signal_quality_score) ?? 0;
  const bias = summary.market_state?.trade_bias ?? "NEUTRAL";
  const toneClasses =
    bias === "BUY"
      ? "border-emerald-400/30 bg-emerald-500/[0.06]"
      : bias === "SELL"
        ? "border-rose-400/30 bg-rose-500/[0.06]"
        : "border-amber-400/30 bg-amber-500/[0.06]";
  const metrics = summary.raw_metrics ?? {};

  return (
    <article className={`rounded-3xl border p-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{summary.symbol}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">{summary.summary_line}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-white">{score}</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/70">
            {summary.signal_quality_label}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/80">
        <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Trend</p>
          <p className="mt-1">{summary.market_state?.trend ?? "n/a"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Bias</p>
          <p className="mt-1">{summary.market_state?.trade_bias ?? "n/a"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Spread</p>
          <p className="mt-1">{formatMetric(metrics.spread_pct)}%</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Delta 10s</p>
          <p className="mt-1">{formatMetric(metrics.short_term_price_change_pct_10s)}%</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Volatility</p>
          <p className="mt-1">{summary.market_state?.volatility ?? "n/a"}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Vol 10s</p>
          <p className="mt-1">${formatMetric(metrics.rolling_volume_10s_usd)}</p>
        </div>
      </div>
    </article>
  );
}

function TradeLogRow({ event, viewMode }: { event: TradeLogEvent; viewMode: ViewMode }) {
  const tone = eventTone(event);
  const toneClasses =
    tone === "green"
      ? "border-emerald-400/20 bg-emerald-500/[0.05]"
      : tone === "red"
        ? "border-rose-400/20 bg-rose-500/[0.05]"
        : "border-amber-400/20 bg-amber-500/[0.05]";
  const summary = event.details?.summary_line;
  const score =
    typeof event.details?.signal_quality_score === "number" || typeof event.details?.signal_quality_score === "string"
      ? event.details.signal_quality_score
      : null;

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClasses}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-white/45">
        <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
        <span>{event.symbol}</span>
        <span>{event.event_type.replaceAll("_", " ")}</span>
        <span>{event.source ?? "coinbase"}</span>
        {score != null ? <span>Score {score}</span> : null}
      </div>
      <p className="mt-1 text-sm text-white">{event.message}</p>
      {typeof summary === "string" ? <p className="mt-1 text-xs text-emerald-100/70">{summary}</p> : null}
      {viewMode === "expanded" && event.details && Object.keys(event.details).length > 0 ? (
        <div className="mt-3">
          <DetailList value={event.details} />
        </div>
      ) : null}
    </div>
  );
}

export default function TradeLogPage() {
  const [events, setEvents] = useState<TradeLogEvent[]>([]);
  const [summaries, setSummaries] = useState<TradeLogSummary[]>([]);
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("expanded");
  const [status, setStatus] = useState("Connecting...");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams({
      window_seconds: "120",
      limit: "200",
    });
    if (symbolFilter !== "all") params.set("symbol", symbolFilter);
    if (eventTypeFilter !== "all") params.set("event_type", eventTypeFilter);

    const res = await authFetch(`/v1/logs/trade?${params.toString()}`);
    if (!res) {
      setStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setStatus(await parseErrorMessage(res));
      return;
    }
    const payload = (await res.json()) as TradeLogPayload;
    setEvents(payload.events ?? []);
    setSummaries(payload.summaries ?? []);
    setAvailableSymbols(payload.available_symbols ?? []);
    setAvailableEventTypes(payload.available_event_types ?? []);
    const eventCount = payload.count ?? 0;
    const summaryCount = payload.summaries?.length ?? 0;
    setStatus(eventCount ? `Streaming ${eventCount} events across ${summaryCount} symbols` : "No recent signal activity");
  }, [eventTypeFilter, symbolFilter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      void loadEvents();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadEvents, paused]);

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const eventTime = Date.parse(event.timestamp);
      if (clearedAt != null && !Number.isNaN(eventTime) && eventTime < clearedAt) {
        return false;
      }
      return isVisibleEvent(event, visibilityMode);
    });
  }, [clearedAt, events, visibilityMode]);

  useEffect(() => {
    if (!autoScroll) return;
    const node = terminalRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [autoScroll, visibleEvents]);

  return (
    <AppShell
      title="Signal Intelligence Panel"
      subtitle="Redis-backed, sampled market interpretation for the last two minutes. Visibility only; nothing here feeds live trading decisions or PostgreSQL."
    >
      <section className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="oz-panel space-y-3 border border-emerald-500/20 bg-[#05080d] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Signal Summary</p>
                <p className="mt-1 text-xs text-emerald-100/70">{status}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={symbolFilter}
                  onChange={(event) => setSymbolFilter(event.target.value)}
                  className="h-10 rounded-xl border border-emerald-500/20 bg-black/40 px-3 text-sm text-emerald-100 outline-none"
                >
                  <option value="all">All symbols</option>
                  {availableSymbols.map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </select>
                <select
                  value={eventTypeFilter}
                  onChange={(event) => setEventTypeFilter(event.target.value)}
                  className="h-10 rounded-xl border border-emerald-500/20 bg-black/40 px-3 text-sm text-emerald-100 outline-none"
                >
                  <option value="all">All event types</option>
                  {availableEventTypes.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {eventType.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summaries.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-6 text-sm text-white/60">
                  No symbol summaries in the current window.
                </div>
              ) : (
                summaries.map((summary) => <SummaryCard key={summary.symbol} summary={summary} />)
              )}
            </div>
          </div>

          <aside className="oz-panel space-y-3 border border-emerald-500/20 bg-[#05080d] p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Controls</p>
              <p className="mt-1 text-xs text-white/60">Switch between raw vs interpreted activity without leaving the live stream.</p>
            </div>

            <div className="grid gap-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                <p className="px-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Visibility</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["all", "raw", "enriched"] as VisibilityMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setVisibilityMode(mode)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                        visibilityMode === mode
                          ? "bg-emerald-500/20 text-emerald-100"
                          : "border border-white/10 text-white/65"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                <p className="px-2 text-[10px] uppercase tracking-[0.16em] text-white/45">View</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["compact", "expanded"] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                        viewMode === mode
                          ? "bg-emerald-500/20 text-emerald-100"
                          : "border border-white/10 text-white/65"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaused((current) => !current)}
                  className="h-10 rounded-xl border border-white/10 bg-black/30 text-xs font-semibold uppercase tracking-wide text-white/80"
                >
                  {paused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={() => setAutoScroll((current) => !current)}
                  className="h-10 rounded-xl border border-white/10 bg-black/30 text-xs font-semibold uppercase tracking-wide text-white/80"
                >
                  {autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setClearedAt(Date.now())}
                className="h-10 rounded-xl border border-white/10 bg-black/30 text-xs font-semibold uppercase tracking-wide text-white/80"
              >
                Clear stream
              </button>
            </div>
          </aside>
        </div>

        <section className="oz-panel border border-emerald-500/20 bg-[#05080d] p-3 font-mono text-sm text-emerald-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Event Stream</p>
              <p className="mt-1 text-xs text-white/60">
                Green = bullish / buy bias, red = bearish / sell bias, yellow = neutral.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">{visibleEvents.length} rows</p>
          </div>

          <div
            ref={terminalRef}
            className="mt-3 h-[65vh] overflow-y-auto rounded-3xl border border-emerald-500/15 bg-black/50 p-3"
          >
            {visibleEvents.length === 0 ? (
              <p className="text-xs text-emerald-100/45">No matching events in the current window.</p>
            ) : (
              <div className="space-y-2">
                {visibleEvents.map((event, index) => (
                  <TradeLogRow
                    key={`${event.timestamp}-${event.symbol}-${event.event_type}-${index}`}
                    event={event}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
