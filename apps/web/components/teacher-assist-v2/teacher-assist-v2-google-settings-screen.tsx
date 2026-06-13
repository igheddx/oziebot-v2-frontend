"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  disconnectV2TeacherGoogle,
  fetchV2TeacherGoogleConnection,
  startV2TeacherGoogleOAuth,
} from "@/lib/teacher-assist-v2-api";
import type { GoogleFormsConnectionStatus } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2GoogleSettingsScreen() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<GoogleFormsConnectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setError(null);
    try {
      setConnection(await fetchV2TeacherGoogleConnection());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load Google connection.");
    }
  };

  useEffect(() => {
    void refresh();
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("error");
    if (connected === "1") setMessage("Google account connected successfully.");
    if (oauthError) setError(decodeURIComponent(oauthError));
  }, [searchParams]);

  return (
    <div className="max-w-xl space-y-4 text-left">
      <header>
        <Link href="/teacher-assist-v2/packages" className="text-xs font-semibold text-sky-700">
          ← Back to packages
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Google connection</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect your Google account to create real Google Form quizzes from TeacherAssist assignments.
        </p>
      </header>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      {!connection ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm">
          <p>
            Status:{" "}
            <span className="font-medium">{connection.connected ? "Connected" : "Not connected"}</span>
          </p>
          {connection.google_email ? <p className="mt-2">Account: {connection.google_email}</p> : null}
          {!connection.server_integration_ready ? (
            <p className="mt-2 text-amber-800">
              Server Google integration is not ready. Contact your administrator.
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            {connection.connected ? (
              <button
                type="button"
                className="ta-button-secondary h-9 px-4 text-sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void disconnectV2TeacherGoogle()
                    .then(() => refresh())
                    .catch((nextError) =>
                      setError(nextError instanceof Error ? nextError.message : "Disconnect failed."),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Disconnect Google
              </button>
            ) : (
              <button
                type="button"
                className="ta-button-primary h-9 px-4 text-sm"
                disabled={busy || !connection.integration_ready}
                onClick={() => {
                  setBusy(true);
                  void startV2TeacherGoogleOAuth()
                    .then((payload) => {
                      window.location.href = payload.authorization_url;
                    })
                    .catch((nextError) =>
                      setError(nextError instanceof Error ? nextError.message : "Could not start Google sign-in."),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Connect Google
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
