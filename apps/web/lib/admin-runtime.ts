import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export type RuntimeServiceStatus = {
  service: string;
  label: string;
  description: string;
  level: "healthy" | "warning" | "critical" | "unknown";
  status: string;
  ready: boolean;
  degraded: boolean;
  degraded_reason: string | null;
  started_at: string | null;
  last_heartbeat_at: string | null;
  heartbeat_age_seconds: number | null;
  stale_after_seconds: number | null;
  details: Record<string, unknown>;
};

export type RuntimeModeActivity = {
  count: number;
  last_at: string | null;
};

export type RuntimeStatusResponse = {
  generated_at: string;
  window_minutes: number;
  overall_status: "healthy" | "warning" | "critical" | "unknown";
  pipeline_status: "active" | "idle" | "problem";
  registry: {
    connected: boolean;
    error: string | null;
  };
  summary: {
    healthy_services: number;
    warning_services: number;
    critical_services: number;
    unknown_services: number;
    paper_orders_recent: number;
    live_orders_recent: number;
    paper_fills_recent: number;
    live_fills_recent: number;
  };
  activity: {
    market_data: {
      trade_ticks: number;
      bbo_updates: number;
      last_at: string | null;
    };
    strategy: Record<"paper" | "live", RuntimeModeActivity>;
    risk: Record<"paper" | "live", RuntimeModeActivity>;
    execution_orders: Record<"paper" | "live", RuntimeModeActivity>;
    execution_trades: Record<"paper" | "live", RuntimeModeActivity>;
  };
  services: RuntimeServiceStatus[];
};

export async function fetchRuntimeStatus(): Promise<{
  data?: RuntimeStatusResponse;
  error?: string;
}> {
  const res = await authFetch("/v1/admin/platform/runtime");
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as RuntimeStatusResponse };
}
