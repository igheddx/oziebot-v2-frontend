"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { RowSkeleton } from "@/components/ui/skeleton";
import { fetchRuntimeStatus, type RuntimeServiceStatus, type RuntimeStatusResponse } from "@/lib/admin-runtime";

const REFRESH_INTERVAL_MS = 5000;

function toneClass(level: string) {
  switch (level) {
    case "healthy":
    case "active":
      return "bg-positive/15 text-positive";
    case "warning":
      return "bg-amber-400/20 text-amber-300";
    case "critical":
    case "problem":
      return "bg-negative/15 text-negative";
    default:
      return "bg-surface text-muted";
  }
}

function formatTimestamp(value: string | null) {
  if (!value) return "No recent activity";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatAgeSeconds(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "No heartbeat";
  if (value < 60) return `${value.toFixed(1)}s ago`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s ago`;
}

function serviceDetailText(service: RuntimeServiceStatus) {
  if (service.degraded_reason) return service.degraded_reason.replaceAll("_", " ");
  if (service.status === "missing") return "No shared heartbeat published yet.";
  if (!service.ready) return "Process heartbeat is present but readiness is not green.";
  return "Heartbeat and readiness look healthy.";
}

function ModeActivityCard({
  label,
  activity,
}: {
  label: string;
  activity: RuntimeStatusResponse["activity"]["strategy"];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(["paper", "live"] as const).map((mode) => (
        <div key={mode} className="rounded-2xl border border-border px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {label} {mode}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activity[mode].count}</p>
          <p className="mt-1 text-xs text-muted">Last seen: {formatTimestamp(activity[mode].last_at)}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminRuntimePage() {
  const { role } = useAuth();
  const isRootAdmin = role === "root_admin";
  const [data, setData] = useState<RuntimeStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isRootAdmin) return;
    const response = await fetchRuntimeStatus();
    if (response.error) {
      setStatus(response.error);
      setLoading(false);
      return;
    }
    setData(response.data ?? null);
    setStatus(null);
    setLoading(false);
  }, [isRootAdmin]);

  useEffect(() => {
    void load();
    if (!isRootAdmin) return;
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isRootAdmin, load]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Overall", value: data.overall_status, tone: data.overall_status },
      { label: "Pipeline", value: data.pipeline_status, tone: data.pipeline_status },
      { label: "Paper Orders", value: String(data.summary.paper_orders_recent), tone: "active" },
      { label: "Live Orders", value: String(data.summary.live_orders_recent), tone: data.summary.live_orders_recent ? "active" : "unknown" },
      { label: "Paper Fills", value: String(data.summary.paper_fills_recent), tone: "active" },
      { label: "Live Fills", value: String(data.summary.live_fills_recent), tone: data.summary.live_fills_recent ? "active" : "unknown" },
    ];
  }, [data]);

  if (!isRootAdmin) {
    return (
      <AppShell title="Runtime Status" subtitle="Root admin access is required.">
        <section className="oz-panel p-4 text-sm text-muted">
          This screen is only available to root admins because it exposes platform-wide worker and trading activity.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Runtime Status"
      subtitle="Low-cost polling view of the core engines, worker heartbeats, and recent trading pipeline activity."
      showModeToggle={false}
    >
      {loading && !data ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : (
        <>
          <section className="oz-panel space-y-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Auto Refresh</p>
                <p className="text-xs text-muted">
                  Every {REFRESH_INTERVAL_MS / 1000}s. Last update: {formatTimestamp(data?.generated_at ?? null)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted"
                onClick={() => void load()}
              >
                Refresh now
              </button>
            </div>
            {status ? <p className="text-xs text-amber-300">{status}</p> : null}
            {data && !data.registry.connected ? (
              <p className="text-xs text-amber-300">
                Shared heartbeat registry is unavailable. Recent DB activity still loads, but service heartbeats may show unknown.
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-border px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{card.label}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${toneClass(card.tone)}`}>
                      {card.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {data ? (
            <>
              <section className="oz-panel space-y-3 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Market Data Window</p>
                  <p className="text-xs text-muted">
                    Last {data.window_minutes} minutes of system activity across ingestion, strategy, risk, and execution.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Trade Ticks</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{data.activity.market_data.trade_ticks}</p>
                    <p className="mt-1 text-xs text-muted">
                      Last seen: {formatTimestamp(data.activity.market_data.last_at)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">BBO Updates</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{data.activity.market_data.bbo_updates}</p>
                    <p className="mt-1 text-xs text-muted">
                      Last seen: {formatTimestamp(data.activity.market_data.last_at)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border px-3 py-3 sm:col-span-2">
                    <ModeActivityCard label="Strategy Signals" activity={data.activity.strategy} />
                  </div>
                  <div className="rounded-2xl border border-border px-3 py-3 sm:col-span-2">
                    <ModeActivityCard label="Risk Decisions" activity={data.activity.risk} />
                  </div>
                  <div className="rounded-2xl border border-border px-3 py-3 sm:col-span-2">
                    <ModeActivityCard label="Execution Orders" activity={data.activity.execution_orders} />
                  </div>
                  <div className="rounded-2xl border border-border px-3 py-3 sm:col-span-2">
                    <ModeActivityCard label="Execution Fills" activity={data.activity.execution_trades} />
                  </div>
                </div>
              </section>

              <section className="oz-panel space-y-3 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Core Services</p>
                  <p className="text-xs text-muted">Heartbeat-backed view of the engines and workers that keep trading alive.</p>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {data.services.map((service) => (
                    <article key={service.service} className="rounded-2xl border border-border px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{service.label}</p>
                          <p className="mt-1 text-xs text-muted">{service.description}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${toneClass(service.level)}`}>
                          {service.level}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                        <p>Status: <span className="text-foreground">{service.status}</span></p>
                        <p>Ready: <span className="text-foreground">{service.ready ? "yes" : "no"}</span></p>
                        <p>Heartbeat: <span className="text-foreground">{formatAgeSeconds(service.heartbeat_age_seconds)}</span></p>
                        <p>Last seen: <span className="text-foreground">{formatTimestamp(service.last_heartbeat_at)}</span></p>
                      </div>
                      <p className="mt-3 text-xs text-muted">{serviceDetailText(service)}</p>
                      {Object.keys(service.details).length ? (
                        <pre className="mt-3 overflow-x-auto rounded-xl border border-border/80 bg-surface/40 p-3 text-[11px] text-muted">
                          {JSON.stringify(service.details, null, 2)}
                        </pre>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
