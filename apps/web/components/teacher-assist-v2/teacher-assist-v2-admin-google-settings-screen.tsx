"use client";

import { useEffect, useState } from "react";

import { fetchV2AdminGoogleSettings } from "@/lib/teacher-assist-v2-api";
import type { AdminGoogleSettings } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2AdminGoogleSettingsScreen() {
  const [settings, setSettings] = useState<AdminGoogleSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchV2AdminGoogleSettings()
      .then(setSettings)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Could not load settings."));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
    );
  }

  if (!settings) return <p className="text-sm text-slate-600">Loading Google integration settings…</p>;

  return (
    <div className="max-w-3xl space-y-4 text-left">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Google Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Server configuration for TeacherAssist Google Forms quiz integration. Secrets stay on the API server only.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm">
        <h2 className="font-semibold text-slate-900">Integration status</h2>
        <ul className="mt-3 space-y-2">
          <li>OAuth client ID: {settings.oauth_client_configured ? "Configured" : "Missing"}</li>
          <li>OAuth client secret: {settings.oauth_client_secret_configured ? "Configured" : "Missing"}</li>
          <li>Token encryption (Fernet): {settings.token_encryption_configured ? "Configured" : "Missing"}</li>
          <li>
            Ready for teachers:{" "}
            <span className={settings.integration_ready ? "text-emerald-700 font-medium" : "text-amber-800 font-medium"}>
              {settings.integration_ready ? "Yes" : "No"}
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-600">Redirect URI: {settings.redirect_uri}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm">
        <h2 className="font-semibold text-slate-900">Required API scopes</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          {settings.required_scopes.map((scope) => (
            <li key={scope} className="font-mono text-xs">
              {scope}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm">
        <h2 className="font-semibold text-slate-900">Google Cloud setup</h2>
        <ol className="mt-2 list-decimal pl-5 space-y-2">
          {settings.setup_instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <ul className="mt-4 list-disc pl-5 text-xs text-slate-600 space-y-1">
          {settings.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Environment variables (API server)</p>
        <ul className="mt-2 font-mono text-xs space-y-1">
          <li>TEACHER_ASSIST_GOOGLE_OAUTH_CLIENT_ID</li>
          <li>TEACHER_ASSIST_GOOGLE_OAUTH_CLIENT_SECRET</li>
          <li>TEACHER_ASSIST_GOOGLE_OAUTH_REDIRECT_URI</li>
          <li>TEACHER_ASSIST_GOOGLE_OAUTH_FRONTEND_REDIRECT</li>
          <li>EXCHANGE_CREDENTIALS_ENCRYPTION_KEY</li>
        </ul>
      </section>
    </div>
  );
}
