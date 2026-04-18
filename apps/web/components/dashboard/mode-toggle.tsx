"use client";

import { useTradingMode } from "@/components/providers/trading-mode-provider";

type ModeToggleProps = {
  variant?: "panel" | "drawer";
};

export function ModeBadge() {
  const { mode } = useTradingMode();
  const active = mode === "live";

  return (
    <span
      className={`inline-flex min-w-20 items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        active
          ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
          : "border-sky-300/40 bg-sky-400/15 text-sky-100"
      }`}
    >
      {mode}
    </span>
  );
}

export function ModeToggle({ variant = "panel" }: ModeToggleProps) {
  const { mode, setMode, modeLabel } = useTradingMode();
  const active = mode === "live";
  const panelClass =
    variant === "drawer"
      ? "rounded-2xl border border-border bg-card/80 p-3"
      : `oz-panel p-3 ${active ? "oz-mode-live" : "oz-mode-paper"}`;
  const labelClass = variant === "drawer" ? "text-muted" : "text-current/85";
  const valueClass = variant === "drawer" ? "text-foreground" : "text-current";
  const inactiveClass =
    variant === "drawer"
      ? "border-border bg-background text-muted"
      : "border-border bg-card/70 text-muted";

  return (
    <div className={panelClass}>
      <div className="mb-3 flex items-center justify-between">
        <p className={`text-[11px] font-semibold tracking-[0.14em] ${labelClass}`}>CURRENT MODE</p>
        <p className={`font-mono text-xs font-semibold ${valueClass}`}>{modeLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("paper")}
          className={`h-11 rounded-xl border text-sm font-semibold ${
            mode === "paper" ? "border-sky-300 bg-sky-400/20 text-sky-100" : inactiveClass
          }`}
        >
          PAPER
        </button>
        <button
          type="button"
          onClick={() => setMode("live")}
          className={`h-11 rounded-xl border text-sm font-semibold ${
            mode === "live" ? "border-amber-300 bg-amber-400/20 text-amber-100" : inactiveClass
          }`}
        >
          LIVE
        </button>
      </div>
    </div>
  );
}
