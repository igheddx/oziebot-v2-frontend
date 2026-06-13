"use client";

import Link from "next/link";
import { useState } from "react";

import { AppSwitcher } from "@/components/platform/app-switcher";
import { useAuth } from "@/components/providers/auth-provider";
import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import { routeForProductKey } from "@/lib/products";

export function TeacherAssistV2SettingsScreen() {
  const { user, products, defaultProduct, setDefaultProduct } = useAuth();
  const { context } = useTeacherAssistV2();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const isRootAdmin = context?.role === "root_admin";
  const tradingProduct = products.find((product) => product.product_key === "trading");
  const teacherProduct = products.find((product) => product.product_key === "teacher_assist");

  return (
    <div className="space-y-5">
      <header className="ta-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Switch between TeacherAssist and OzieBot Trading without changing permissions.
        </p>
      </header>

      {message ? (
        <div className="ta-panel border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>
      ) : null}
      {error ? (
        <div className="ta-panel border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      ) : null}

      {isRootAdmin ? (
        <section className="ta-panel p-5">
          <h2 className="text-base font-semibold text-slate-900">AI provider</h2>
          <p className="mt-2 text-sm text-slate-600">
            Global TeacherAssist AI mode, model, cost limits, and connection testing live on the dedicated AI
            Settings page.
          </p>
          <Link href="/teacher-assist-v2/admin/ai-settings" className="ta-button-primary mt-4 inline-flex">
            Open AI Settings
          </Link>
        </section>
      ) : null}

      <section className="ta-panel p-5">
        <h2 className="text-base font-semibold text-slate-900">Profile</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{user?.full_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">TeacherAssist role</dt>
            <dd className="font-medium text-slate-900">{context?.role ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Default app</dt>
            <dd className="font-medium text-slate-900">{defaultProduct ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="ta-panel p-5">
        <h2 className="text-base font-semibold text-slate-900">App switcher</h2>
        <p className="mt-2 text-sm text-slate-600">Use the header switcher or set your default landing app below.</p>
        <div className="mt-4">
          <AppSwitcher />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {teacherProduct ? (
            <button
              type="button"
              className="ta-button-primary"
              disabled={pendingKey === "teacher_assist"}
              onClick={() => {
                setPendingKey("teacher_assist");
                setError(null);
                void setDefaultProduct("teacher_assist")
                  .then(() => setMessage("TeacherAssist is now your default app."))
                  .catch((nextError: Error) => setError(nextError.message))
                  .finally(() => setPendingKey(null));
              }}
            >
              Set TeacherAssist as default
            </button>
          ) : null}
          {tradingProduct ? (
            <button
              type="button"
              className="ta-button-secondary"
              disabled={pendingKey === "trading"}
              onClick={() => {
                setPendingKey("trading");
                setError(null);
                void setDefaultProduct("trading")
                  .then(() => setMessage("OzieBot Trading is now your default app."))
                  .catch((nextError: Error) => setError(nextError.message))
                  .finally(() => setPendingKey(null));
              }}
            >
              Set Trading as default
            </button>
          ) : null}
          {tradingProduct ? (
            <a href={routeForProductKey("trading")} className="ta-button-secondary inline-flex items-center">
              Open Trading now
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
