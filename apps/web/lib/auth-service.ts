import type { BillingSummary } from "@/lib/dashboard-types";
import type { CoinbaseStatus, SessionBootstrap, SessionUser, TokenPair } from "@/lib/auth-types";

function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    if (hostname.startsWith("app.")) {
      return `${protocol}//api.${hostname.slice(4)}`;
    }
  }
  return "http://localhost:8000";
}

export const ACCESS_TOKEN_KEY = "oziebot:access-token";
export const REFRESH_TOKEN_KEY = "oziebot:refresh-token";
export const TRADING_MODE_KEY = "oziebot:trading-mode";
const AUTH_MARKER_COOKIE = "oziebot_auth";
const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 30;
const REQUEST_ID_HEADER = "X-Oziebot-Request-Id";

type ApiErrorShape = {
  detail?: unknown;
};

type AuthFetchBehavior = {
  clearSessionOn401?: boolean;
  eagerRefresh?: boolean;
};

function isAuth401Response(payload: ApiErrorShape): boolean {
  if (typeof payload.detail === "string") {
    const detail = payload.detail.toLowerCase();
    return detail.includes("not authenticated") || detail.includes("invalid or expired refresh token");
  }
  if (payload.detail && typeof payload.detail === "object") {
    const detailObj = payload.detail as { code?: string; message?: string };
    const code = (detailObj.code ?? "").toLowerCase();
    const message = (detailObj.message ?? "").toLowerCase();
    return code === "not_authenticated" || message.includes("not authenticated");
  }
  return false;
}

type BillingSummaryApi = {
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_active: boolean;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

type CoinbaseConnectionApi = {
  connected: boolean;
  validation_status: string;
  health_status: string | null;
};

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function setAuthMarkerCookie(): void {
  if (!canUseBrowserStorage()) return;
  document.cookie = `${AUTH_MARKER_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function clearAuthMarkerCookie(): void {
  if (!canUseBrowserStorage()) return;
  document.cookie = `${AUTH_MARKER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getStoredAccessToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasStoredTokens(): boolean {
  return Boolean(getStoredAccessToken() && getStoredRefreshToken());
}

export function storeTokenPair(tokens: TokenPair): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  setAuthMarkerCookie();
}

export function clearStoredSession(): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearAuthMarkerCookie();
  window.dispatchEvent(new CustomEvent("oziebot:session-cleared"));
}

function toApiUrl(path: string): string {
  return `${resolveApiBase()}${path}`;
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function withRequestId(headers: Headers): Headers {
  if (!headers.has(REQUEST_ID_HEADER)) {
    headers.set(REQUEST_ID_HEADER, generateRequestId());
  }
  return headers;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!canUseBrowserStorage()) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = window.atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function accessTokenNeedsRefresh(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  const exp = payload?.exp;
  if (typeof exp !== "number") return true;
  const refreshAt = exp - ACCESS_TOKEN_REFRESH_BUFFER_SECONDS;
  return refreshAt <= Math.floor(Date.now() / 1000);
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as ApiErrorShape;
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail && typeof payload.detail === "object") {
      const maybe = payload.detail as { message?: string; code?: string };
      if (maybe.message) return maybe.message;
      if (maybe.code) return maybe.code;
    }
  } catch {
    // Fall through to generic error.
  }
  return `Request failed (${res.status})`;
}

async function postJson<TReq extends Record<string, unknown>, TRes>(path: string, body: TReq): Promise<TRes> {
  const headers = withRequestId(new Headers({ "Content-Type": "application/json" }));
  const res = await fetch(toApiUrl(path), {
    method: "POST",
    cache: "no-store",
    headers: Object.fromEntries(headers.entries()),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as TRes;
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const tokens = await postJson<{ email: string; password: string }, TokenPair>("/v1/auth/login", {
    email,
    password,
  });
  storeTokenPair(tokens);
  return tokens;
}

export async function refreshTokens(): Promise<boolean> {
  const refresh = getStoredRefreshToken();
  if (!refresh) return false;
  try {
    const tokens = await postJson<{ refresh_token: string }, TokenPair>("/v1/auth/refresh", {
      refresh_token: refresh,
    });
    storeTokenPair(tokens);
    return true;
  } catch {
    return false;
  }
}

export async function authFetch(
  path: string,
  init: RequestInit = {},
  behavior: AuthFetchBehavior = {},
): Promise<Response | null> {
  const { clearSessionOn401 = true, eagerRefresh = true } = behavior;
  const baseHeaders = withRequestId(new Headers(init.headers));
  if (!baseHeaders.has("Content-Type")) {
    baseHeaders.set("Content-Type", "application/json");
  }

  const send = (accessToken: string | null) =>
    fetch(toApiUrl(path), {
      ...init,
      cache: "no-store",
      credentials: "include",
      headers: {
        ...Object.fromEntries(baseHeaders.entries()),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

  try {
    let accessToken = getStoredAccessToken();
    if (eagerRefresh && accessTokenNeedsRefresh(accessToken) && getStoredRefreshToken()) {
      const refreshed = await refreshTokens();
      accessToken = refreshed ? getStoredAccessToken() : accessToken;
    }

    let res = await send(accessToken);
    if (res.status === 401 && (await refreshTokens())) {
      res = await send(getStoredAccessToken());
    }
    if (clearSessionOn401 && res.status === 401) {
      let shouldClear = true;
      try {
        const payload = (await res.clone().json()) as ApiErrorShape;
        shouldClear = isAuth401Response(payload);
      } catch {
        shouldClear = true;
      }
      if (shouldClear) clearStoredSession();
    }
    return res;
  } catch {
    return null;
  }
}

function mapBilling(payload: BillingSummaryApi): BillingSummary {
  return {
    trialStartedAt: payload.trial_started_at,
    trialEndsAt: payload.trial_ends_at,
    trialActive: payload.trial_active,
    subscriptionStatus: payload.subscription_status,
    stripeSubscriptionId: payload.stripe_subscription_id,
    currentPeriodEnd: payload.current_period_end,
  };
}

function modeToStorage(user: SessionUser): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(TRADING_MODE_KEY, user.current_trading_mode);
  window.dispatchEvent(new CustomEvent("oziebot:mode-sync", { detail: user.current_trading_mode }));
}

export async function fetchSessionBootstrap(): Promise<SessionBootstrap> {
  const meRes = await authFetch("/v1/me", undefined, { eagerRefresh: false });
  if (!meRes || !meRes.ok) {
    throw new Error(meRes ? await parseApiError(meRes) : "Could not reach API");
  }
  const user = (await meRes.json()) as SessionUser;

  const hasTenantContext = user.tenants.length > 0;
  const [billingRes, coinbaseRes] = hasTenantContext
    ? await Promise.all([
        authFetch("/v1/billing/summary", undefined, { clearSessionOn401: false }),
        authFetch("/v1/integrations/coinbase/status", undefined, { clearSessionOn401: false }),
      ])
    : [null, null];

  const billing = billingRes && billingRes.ok ? mapBilling((await billingRes.json()) as BillingSummaryApi) : null;

  let coinbase: CoinbaseStatus = { connected: false, validationStatus: null, healthStatus: null };
  if (coinbaseRes && coinbaseRes.ok) {
    const payload = (await coinbaseRes.json()) as CoinbaseConnectionApi;
    coinbase = {
      connected: payload.connected,
      validationStatus: payload.validation_status ?? null,
      healthStatus: payload.health_status,
    };
  }

  modeToStorage(user);
  return { user, billing, coinbase };
}

export async function logout(): Promise<void> {
  const refresh = getStoredRefreshToken();
  if (refresh) {
    const headers = withRequestId(new Headers({ "Content-Type": "application/json" }));
    await fetch(toApiUrl("/v1/auth/logout"), {
      method: "POST",
      headers: Object.fromEntries(headers.entries()),
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => {
      // Best effort only.
    });
  }
  clearStoredSession();
}

export async function parseErrorMessage(res: Response): Promise<string> {
  return parseApiError(res);
}
