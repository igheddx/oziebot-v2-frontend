"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";

type TradeLogEvent = {
  timestamp: string;
  symbol: string;
  event_type: string;
  message: string;
};

const POLL_MS = 4000;

export default function TradeLogPage() {
  const [events, setEvents] = useState<TradeLogEvent[]>([]);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const loadEvents = useCallback(async () => {
    const res = await authFetch("/v1/logs/trade?window_seconds=120&limit=200");
    if (!res) {
      setStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setStatus(await parseErrorMessage(res));
      return;
    }
    const payload = (await res.json()) as { events: TradeLogEvent[]; count: number };
    setEvents(payload.events ?? []);
    setStatus(payload.count ? `Streaming ${payload.count} recent events` : "No recent trade log events");
  }, []);

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

  const filteredEvents = useMemo(() => {
    const normalizedFilter = symbolFilter.trim().toUpperCase();
    return events.filter((event) => {
      const eventTime = Date.parse(event.timestamp);
      if (clearedAt != null && !Number.isNaN(eventTime) && eventTime < clearedAt) {
        return false;
      }
      if (!normalizedFilter) return true;
      return event.symbol.includes(normalizedFilter);
    });
  }, [clearedAt, events, symbolFilter]);

  useEffect(() => {
    if (!autoScroll) return;
    const node = terminalRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [autoScroll, filteredEvents]);

  return (
    <AppShell
      title="Trade Log"
      subtitle="Rolling Redis-backed market-data activity for the last two minutes. Visibility only; nothing here is stored in PostgreSQL."
    >
      <section className="oz-panel space-y-3 border border-emerald-500/20 bg-[#05080d] p-3 font-mono text-sm text-emerald-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Market Data Log</p>
            <p className="mt-1 text-xs text-emerald-100/70">{status}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={symbolFilter}
              onChange={(event) => setSymbolFilter(event.target.value)}
              placeholder="Filter symbol"
              className="h-10 rounded-xl border border-emerald-500/20 bg-black/40 px-3 text-sm text-emerald-100 outline-none placeholder:text-emerald-100/35"
            />
            <button
              type="button"
              onClick={() => setPaused((current) => !current)}
              className="h-10 rounded-xl border border-emerald-500/20 px-3 text-xs font-semibold uppercase tracking-wide text-emerald-100/80"
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => setAutoScroll((current) => !current)}
              className="h-10 rounded-xl border border-emerald-500/20 px-3 text-xs font-semibold uppercase tracking-wide text-emerald-100/80"
            >
              {autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            </button>
            <button
              type="button"
              onClick={() => setClearedAt(Date.now())}
              className="h-10 rounded-xl border border-emerald-500/20 px-3 text-xs font-semibold uppercase tracking-wide text-emerald-100/80"
            >
              Clear
            </button>
          </div>
        </div>

        <div
          ref={terminalRef}
          className="h-[65vh] overflow-y-auto rounded-2xl border border-emerald-500/15 bg-black/50 p-3"
        >
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-emerald-100/45">No matching events in the current window.</p>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event, index) => (
                <div
                  key={`${event.timestamp}-${event.symbol}-${event.event_type}-${index}`}
                  className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-emerald-300/65">
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span>{event.symbol}</span>
                    <span>{event.event_type.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-sm text-emerald-50">{event.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
