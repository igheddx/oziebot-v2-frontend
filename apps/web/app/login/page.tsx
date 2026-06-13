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
    <div className="teacher-assist-theme oz-login-shell min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8 sm:max-w-lg sm:px-6 sm:py-10">
        <section className="ta-panel p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Image
              src={logo}
              alt="Oziebot"
              priority
              className="h-auto w-40 sm:w-48"
              sizes="(min-width: 640px) 192px, 160px"
            />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Platform</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in to OzieBot</h1>
            <p className="mt-2 max-w-sm text-sm text-slate-600">
              One account for TeacherAssist, Trading, and the rest of your OzieBot workspace.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="ta-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="ta-input h-11"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="ta-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="ta-input h-11"
              />
            </div>

            {formError ? <p className="ta-alert ta-alert-error">{formError}</p> : null}

            <button type="submit" disabled={!canSubmit} className="ta-button-primary h-11 w-full">
              {isSubmitting || status === "loading" ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          After signing in, use the app switcher to open TeacherAssist, Trading, or your default module.
        </p>
      </div>
    </div>
  );
}
