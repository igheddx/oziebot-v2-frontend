"use client";

export const PRIMARY_NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/strategies", label: "Strategies" },
  { href: "/tokens", label: "Tokens" },
  { href: "/allocation", label: "Allocation" },
  { href: "/strategic-allocation", label: "Strategic Allocation" },
  { href: "/volatility-harvest", label: "Volatility Harvest" },
  { href: "/alerts", label: "Alerts" },
] as const;

export const SECONDARY_NAV_LINKS = [
  { href: "/analytics", label: "Analytics" },
  { href: "/trade-log", label: "Trade Log" },
  { href: "/trading-performance-export", label: "Export trades (CSV)" },
  { href: "/onboarding", label: "Setup" },
] as const;

export const ADMIN_NAV_LINKS = [
  { href: "/admin/runtime", label: "Runtime" },
  { href: "/admin/ai-diagnostics", label: "AI Diagnostic Review" },
  { href: "/admin/trading-diagnostics", label: "Trading Diagnostics" },
  { href: "/admin/token-policy", label: "Admin" },
  { href: "/admin/fee-settings", label: "Fee Settings" },
] as const;
