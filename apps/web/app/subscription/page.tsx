"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { useTradingMode } from "@/components/providers/trading-mode-provider";
import { authFetch, parseErrorMessage } from "@/lib/auth-service";
import { RowSkeleton } from "@/components/ui/skeleton";
import { getBillingSummary } from "@/lib/dashboard-api";
import type { BillingSummary } from "@/lib/dashboard-types";

type AdminPlan = {
  id: string;
  slug: string;
  display_name: string;
  plan_kind: "all_strategies" | "per_strategy";
  stripe_price_id: string;
  billing_interval: "month" | "year";
  amount_cents: number;
  is_active: boolean;
};

export default function SubscriptionPage() {
  const { mode } = useTradingMode();
  const { role } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [planKind, setPlanKind] = useState<"all_strategies" | "per_strategy">("all_strategies");
  const [priceId, setPriceId] = useState("");
  const [amountCents, setAmountCents] = useState("1999");

  useEffect(() => {
    let mounted = true;
    getBillingSummary(mode).then((data) => {
      if (mounted) setSummary(data);
    });
    return () => {
      mounted = false;
    };
  }, [mode]);

  const isRootAdmin = role === "root_admin";

  const loadPlans = useCallback(async () => {
    if (!isRootAdmin) return;
    setPlansLoading(true);
    const res = await authFetch("/v1/admin/platform/subscription-plans");
    if (!res) {
      setAdminStatus("Could not reach API.");
      setPlansLoading(false);
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      setPlansLoading(false);
      return;
    }
    setPlans((await res.json()) as AdminPlan[]);
    setPlansLoading(false);
  }, [isRootAdmin]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const createPlan = async () => {
    setAdminStatus(null);
    if (!slug.trim() || !displayName.trim() || !priceId.trim()) {
      setAdminStatus("Slug, display name, and Stripe price id are required.");
      return;
    }
    const amount = Number(amountCents);
    if (!Number.isFinite(amount) || amount < 0) {
      setAdminStatus("Amount must be a non-negative integer (cents).");
      return;
    }
    const res = await authFetch("/v1/admin/platform/subscription-plans", {
      method: "POST",
      body: JSON.stringify({
        slug: slug.trim(),
        display_name: displayName.trim(),
        plan_kind: planKind,
        stripe_price_id: priceId.trim(),
        billing_interval: "month",
        amount_cents: Math.floor(amount),
        currency: "usd",
        is_active: true,
      }),
    });
    if (!res) {
      setAdminStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      return;
    }
    setAdminStatus("Plan created.");
    setSlug("");
    setDisplayName("");
    setPriceId("");
    await loadPlans();
  };

  const togglePlan = async (plan: AdminPlan) => {
    setAdminStatus(null);
    const res = await authFetch(`/v1/admin/platform/subscription-plans/${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !plan.is_active }),
    });
    if (!res) {
      setAdminStatus("Could not reach API.");
      return;
    }
    if (!res.ok) {
      setAdminStatus(await parseErrorMessage(res));
      return;
    }
    await loadPlans();
  };

  return (
    <AppShell title="Subscription" subtitle="Manage billing tier and LIVE access entitlements.">
      {isRootAdmin ? (
        <section className="oz-panel space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Root Admin: Subscription Plans</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Plan slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <select
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              value={planKind}
              onChange={(e) => setPlanKind(e.target.value as "all_strategies" | "per_strategy")}
            >
              <option value="all_strategies">All Strategies</option>
              <option value="per_strategy">Per Strategy</option>
            </select>
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Stripe price id"
              value={priceId}
              onChange={(e) => setPriceId(e.target.value)}
            />
            <input
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sky-400"
              placeholder="Amount cents"
              value={amountCents}
              onChange={(e) => setAmountCents(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="h-10 rounded-lg bg-amber-400 px-3 text-sm font-semibold text-slate-950"
            onClick={createPlan}
          >
            Add Plan
          </button>
          {adminStatus ? <p className="text-xs text-muted">{adminStatus}</p> : null}
          <div className="space-y-2">
            {plansLoading ? (
              <RowSkeleton />
            ) : (
              plans.map((plan) => (
                <article key={plan.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <p className="text-xs text-muted">
                    {plan.display_name} · {plan.plan_kind} · {plan.stripe_price_id} · ${(plan.amount_cents / 100).toFixed(2)}/{plan.billing_interval}
                  </p>
                  <button
                    type="button"
                    className={`h-8 rounded-lg px-2 text-xs font-semibold ${
                      plan.is_active ? "bg-positive/20 text-positive" : "bg-surface text-muted"
                    }`}
                    onClick={() => togglePlan(plan)}
                  >
                    {plan.is_active ? "Active" : "Inactive"}
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {!summary ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : (
        <>
          <section className="oz-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Subscription Status</p>
            <p className="mt-1 text-xl font-semibold">{summary.subscriptionStatus ?? "trial"}</p>
            <p className="text-sm text-muted">
              {summary.currentPeriodEnd
                ? `Current period ends ${new Date(summary.currentPeriodEnd).toLocaleDateString()}`
                : summary.trialActive
                  ? "Trial active"
                  : "No active subscription period"}
            </p>
            <button className="mt-4 h-11 w-full rounded-xl bg-amber-400 font-semibold text-slate-950">Manage Billing</button>
          </section>

          <section className="space-y-2">
            <article className="oz-panel p-3">
              <p className="text-sm font-semibold">Trial Window</p>
              <p className="text-xs text-muted">
                {summary.trialStartedAt ? new Date(summary.trialStartedAt).toLocaleDateString() : "-"} to{" "}
                {summary.trialEndsAt ? new Date(summary.trialEndsAt).toLocaleDateString() : "-"}
              </p>
            </article>
            <article className="oz-panel p-3">
              <p className="text-sm font-semibold">Stripe Subscription</p>
              <p className="text-xs text-muted">{summary.stripeSubscriptionId ?? "Not linked"}</p>
            </article>
          </section>
        </>
      )}
    </AppShell>
  );
}
