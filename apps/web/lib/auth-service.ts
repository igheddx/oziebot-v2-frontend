import type { BillingSummary } from "@/lib/dashboard-types";
import type {
  CoinbaseStatus,
  SessionBootstrap,
  SessionProductsPayload,
  SessionUser,
  TokenPair,
} from "@/lib/auth-types";

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
let refreshInFlight: Promise<boolean> | null = null;

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
  const sessionToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (sessionToken) return sessionToken;
  const legacyToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!legacyToken) return null;
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, legacyToken);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  return legacyToken;
}

export function getStoredRefreshToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasStoredTokens(): boolean {
  return Boolean(getStoredAccessToken() || getStoredRefreshToken());
}

export function storeTokenPair(tokens: TokenPair): void {
  if (!canUseBrowserStorage()) return;
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  setAuthMarkerCookie();
}

export function clearStoredSession(): void {
  if (!canUseBrowserStorage()) return;
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearAuthMarkerCookie();
  window.dispatchEvent(new CustomEvent("oziebot:session-cleared"));
}

function toApiUrl(path: string): string {
  return `${resolveApiBase()}${path}`;
}

export function buildApiUrl(path: string): string {
  return toApiUrl(path);
}

export function resolveTeacherAssistFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? buildApiUrl(url) : url;
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
    if (Array.isArray(payload.detail)) {
      const messages = payload.detail
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as { loc?: unknown[]; msg?: string };
          if (typeof record.msg !== "string") return null;
          const field = Array.isArray(record.loc)
            ? record.loc.filter((part) => typeof part === "string" && part !== "body").join(".")
            : "";
          return field ? `${field}: ${record.msg}` : record.msg;
        })
        .filter((value): value is string => Boolean(value));
      if (messages.length > 0) return messages.join(" ");
    }
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

export async function changePassword(body: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ requires_password_change: boolean; landing_route: string | null }> {
  const response = await authFetch("/v1/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response) {
    throw new Error("Network request failed");
  }
  if (!response.ok) {
    try {
      const payload = await response.json();
      if (payload?.detail?.field_errors) {
        const error = new Error("Validation failed") as Error & { fieldErrors?: Record<string, string> };
        error.fieldErrors = payload.detail.field_errors;
        throw error;
      }
      if (typeof payload.detail === "string") throw new Error(payload.detail);
    } catch (error) {
      if (error instanceof Error) throw error;
    }
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as { requires_password_change: boolean; landing_route: string | null };
}

export async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
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
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function waitForRefreshIfPresent(): Promise<boolean> {
  if (!refreshInFlight) return false;
  try {
    return await refreshInFlight;
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
  const method = (init.method ?? "GET").toUpperCase();
  const baseHeaders = withRequestId(new Headers(init.headers));
  const isFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (
    !isFormDataBody &&
    !baseHeaders.has("Content-Type") &&
    (method === "POST" || method === "PUT" || method === "PATCH")
  ) {
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
    if (res.status === 401) {
      const refreshed = (await waitForRefreshIfPresent()) || (await refreshTokens());
      if (refreshed) {
        res = await send(getStoredAccessToken());
      }
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

type AuthUploadOptions = {
  onProgress?: (progress: number) => void;
  method?: string;
};

export async function authUpload(
  path: string,
  buildFormData: () => FormData,
  options: AuthUploadOptions = {},
): Promise<Response> {
  const method = options.method ?? "POST";

  const send = (accessToken: string | null) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, toApiUrl(path));
      xhr.withCredentials = true;
      const headers = withRequestId(new Headers());
      headers.forEach((value, key) => {
        xhr.setRequestHeader(key, value);
      });
      if (accessToken) {
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      }
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !options.onProgress) return;
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new Error("Could not reach API"));
      xhr.onload = () => {
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
          }),
        );
      };
      xhr.send(buildFormData());
    });

  let accessToken = getStoredAccessToken();
  if (accessTokenNeedsRefresh(accessToken) && getStoredRefreshToken()) {
    const refreshed = await refreshTokens();
    accessToken = refreshed ? getStoredAccessToken() : accessToken;
  }

  let response = await send(accessToken);
  if (response.status === 401) {
    const refreshed = (await waitForRefreshIfPresent()) || (await refreshTokens());
    if (refreshed) {
      response = await send(getStoredAccessToken());
    }
  }
  if (response.status === 401) {
    try {
      const payload = (await response.clone().json()) as ApiErrorShape;
      if (isAuth401Response(payload)) {
        clearStoredSession();
      }
    } catch {
      // Keep the session when the 401 body is not parseable.
    }
  }
  return response;
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
  const meRes = await authFetch("/v1/me");
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

export async function updateDefaultProduct(productKey: string): Promise<SessionProductsPayload> {
  const res = await authFetch("/v1/me/default-product", {
    method: "PATCH",
    body: JSON.stringify({ product_key: productKey }),
  });
  if (!res || !res.ok) {
    throw new Error(res ? await parseApiError(res) : "Could not reach API");
  }
  return (await res.json()) as SessionProductsPayload;
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
