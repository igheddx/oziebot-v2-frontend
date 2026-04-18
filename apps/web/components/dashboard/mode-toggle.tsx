"use client";

import { useTradingMode } from "@/components/providers/trading-mode-provider";

export function ModeToggle() {
  const { mode, setMode, modeLabel } = useTradingMode();
  const active = mode === "live";

  return (
    <div className={`oz-panel p-3 ${active ? "oz-mode-live" : "oz-mode-paper"}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-current/85">CURRENT MODE</p>
        <p className="font-mono text-xs font-semibold text-current">{modeLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("paper")}
          className={`h-11 rounded-xl border text-sm font-semibold ${
            mode === "paper" ? "border-sky-300 bg-sky-400/20 text-sky-100" : "border-border bg-card/70 text-muted"
          }`}
        >
          PAPER
        </button>
        <button
          type="button"
          onClick={() => setMode("live")}
          className={`h-11 rounded-xl border text-sm font-semibold ${
            mode === "live" ? "border-amber-300 bg-amber-400/20 text-amber-100" : "border-border bg-card/70 text-muted"
          }`}
        >
          LIVE
        </button>
      </div>
    </div>
  );
}
