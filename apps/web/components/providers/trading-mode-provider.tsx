"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { TradingMode } from "@/lib/dashboard-types";
import { TRADING_MODE_KEY } from "@/lib/auth-service";

type TradingModeContextValue = {
  mode: TradingMode;
  setMode: (mode: TradingMode) => void;
  modeLabel: string;
};

const TradingModeContext = createContext<TradingModeContextValue | null>(null);

function parseMode(raw: string | null): TradingMode | null {
  if (raw === "paper" || raw === "live") return raw;
  return null;
}

export function TradingModeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setModeState] = useState<TradingMode>("paper");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryMode = parseMode(new URLSearchParams(window.location.search).get("mode"));
    const storedMode = parseMode(window.localStorage.getItem(TRADING_MODE_KEY));
    const nextMode = queryMode ?? storedMode ?? "paper";
    setModeState(nextMode);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onModeSync = (event: Event) => {
      const next = parseMode((event as CustomEvent<string>).detail);
      if (next) setModeState(next);
    };
    window.addEventListener("oziebot:mode-sync", onModeSync);
    return () => {
      window.removeEventListener("oziebot:mode-sync", onModeSync);
    };
  }, []);

  const setMode = useCallback((nextMode: TradingMode) => {
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TRADING_MODE_KEY, nextMode);
    }
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.set("mode", nextMode);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router]);

  const value = useMemo(
    () => ({ mode, setMode, modeLabel: mode === "live" ? "LIVE TRADING" : "PAPER TRADING" }),
    [mode, setMode],
  );

  return <TradingModeContext.Provider value={value}>{children}</TradingModeContext.Provider>;
}

export function useTradingMode() {
  const ctx = useContext(TradingModeContext);
  if (!ctx) throw new Error("useTradingMode must be used within TradingModeProvider");
  return ctx;
}
