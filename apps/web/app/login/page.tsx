"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import logo from "@/images/oziebot-logo.png";

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  const { status, loginWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !isSubmitting;
  }, [email, isSubmitting, password]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!emailLooksValid(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Login failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8 sm:max-w-lg sm:px-6 sm:py-10">
      <section className="oz-panel p-5 sm:p-7">
        <div className="flex flex-col items-center text-center">
          <Image
            src={logo}
            alt="Oziebot"
            priority
            className="h-auto w-44 sm:w-52"
            sizes="(min-width: 640px) 208px, 176px"
          />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Welcome Back</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Log in to continue to your trading dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-sky-400"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-sky-400"
            />
          </div>

          {formError ? <p className="text-sm text-negative">{formError}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full rounded-xl bg-sky-500 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || status === "loading" ? "Signing in..." : "Log In"}
          </button>
        </form>
      </section>
    </div>
  );
}
