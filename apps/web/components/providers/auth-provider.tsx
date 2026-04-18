"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { BillingSummary } from "@/lib/dashboard-types";
import type { CoinbaseStatus, SessionUser, UserRole } from "@/lib/auth-types";
import { clearStoredSession, fetchSessionBootstrap, hasStoredTokens, login, logout } from "@/lib/auth-service";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  role: UserRole | null;
  billing: BillingSummary | null;
  coinbase: CoinbaseStatus | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logoutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = new Set(["/login"]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [coinbase, setCoinbase] = useState<CoinbaseStatus | null>(null);

  const hydrateSession = useCallback(async () => {
    const bootstrap = await fetchSessionBootstrap();
    setUser(bootstrap.user);
    setBilling(bootstrap.billing);
    setCoinbase(bootstrap.coinbase);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!hasStoredTokens()) {
        if (!active) return;
        setStatus("unauthenticated");
        return;
      }

      try {
        await hydrateSession();
      } catch {
        if (!active) return;
        clearStoredSession();
        setStatus("unauthenticated");
        setUser(null);
        setBilling(null);
        setCoinbase(null);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [hydrateSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSessionCleared = () => {
      setStatus("unauthenticated");
      setUser(null);
      setBilling(null);
      setCoinbase(null);
    };
    window.addEventListener("oziebot:session-cleared", onSessionCleared);
    return () => {
      window.removeEventListener("oziebot:session-cleared", onSessionCleared);
    };
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    const isPublicPath = PUBLIC_PATHS.has(pathname);

    if (status === "unauthenticated" && !isPublicPath) {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [pathname, router, status]);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      await login(email, password);
      await hydrateSession();
      router.replace("/dashboard");
    },
    [hydrateSession, router],
  );

  const logoutUser = useCallback(async () => {
    await logout();
    setStatus("unauthenticated");
    setUser(null);
    setBilling(null);
    setCoinbase(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      billing,
      coinbase,
      loginWithPassword,
      logoutUser,
    }),
    [billing, coinbase, loginWithPassword, logoutUser, status, user],
  );

  if (status === "loading" && pathname !== "/login") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-6 text-sm text-muted">
        Loading session...
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}