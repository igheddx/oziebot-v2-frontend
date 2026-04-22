import type { BillingSummary, TradingMode } from "@/lib/dashboard-types";

export type UserRole = "root_admin" | "user";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  role?: UserRole;
};

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_root_admin: boolean;
  current_trading_mode: TradingMode;
  email_verified_at: string | null;
  tenants: Array<{ id: string; name: string; role: string }>;
};

export type CoinbaseStatus = {
  connected: boolean;
  validationStatus: string | null;
  healthStatus: string | null;
};

export type SessionBootstrap = {
  user: SessionUser;
  billing: BillingSummary | null;
  coinbase: CoinbaseStatus;
};
