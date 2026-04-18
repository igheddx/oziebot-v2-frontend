"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";

const steps = [
  { href: "/coinbase", title: "Connect Coinbase", desc: "Required for LIVE mode execution and reconciliation." },
  { href: "/tokens", title: "Select Tokens", desc: "Allow only assets your strategy should trade." },
  { href: "/strategies", title: "Enable Strategies", desc: "Turn strategies on/off and set controls." },
  { href: "/allocation", title: "Allocate Capital", desc: "Set how much each strategy can deploy." },
  { href: "/subscription", title: "Subscription", desc: "Plan and entitlements for LIVE strategy access." },
  { href: "/alerts", title: "Alerts", desc: "Push/email for fills, failures, and drawdown warnings." },
];

export default function OnboardingPage() {
  return (
    <AppShell title="Onboarding" subtitle="Thumb-friendly setup path for a first trading session.">
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <Link
            key={step.href}
            href={step.href}
            className="oz-panel block p-4"
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Step {idx + 1}</p>
            <p className="text-base font-semibold">{step.title}</p>
            <p className="text-sm text-muted">{step.desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
