"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchV2AdminAiProviderConfig,
  fetchV2TeacherAiReadiness,
  testV2AdminAiProviderConnection,
  updateV2AdminAiProviderConfig,
} from "@/lib/teacher-assist-v2-api";
import type { TeacherAiReadiness, TeacherAssistAiAdminConfig } from "@/lib/teacher-assist-v2-types";

function modeBadgeClass(mode: string) {
  return mode === "real_openai"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-sky-200 bg-sky-50 text-sky-800";
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)} (${cents} cents)`;
}

export function TeacherAssistV2AiSettingsScreen() {
  const [aiConfig, setAiConfig] = useState<TeacherAssistAiAdminConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<"mock" | "openai">("mock");
  const [realProviderEnabled, setRealProviderEnabled] = useState(false);
  const [realProviderModel, setRealProviderModel] = useState("");
  const [dailyCostLimitCents, setDailyCostLimitCents] = useState("500");
  const [savePending, setSavePending] = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [readiness, setReadiness] = useState<TeacherAiReadiness | null>(null);

  const refreshReadiness = useCallback(() => {
    return fetchV2TeacherAiReadiness().then(setReadiness);
  }, []);

  useEffect(() => {
    void fetchV2AdminAiProviderConfig()
      .then((config) => {
        setAiConfig(config);
        setAiProvider(config.configured_provider === "openai" ? "openai" : "mock");
        setRealProviderEnabled(config.real_provider_enabled);
        setRealProviderModel(config.real_provider_model ?? config.allowed_models[0] ?? "");
        setDailyCostLimitCents(String(config.daily_cost_limit_cents || 500));
      })
      .catch((nextError: Error) => setError(nextError.message));
    void refreshReadiness().catch(() => undefined);
  }, [refreshReadiness]);

  return (
    <div className="space-y-5">
      <header className="ta-panel p-6">
        <h1 className="text-2xl font-semibold text-slate-900">AI Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Root admin only. Control global TeacherAssist AI mode, model, and daily cost limits. API keys remain
          server-side only.
        </p>
      </header>

      {error ? (
        <div className="ta-panel border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      ) : null}
      {saveMessage ? (
        <div className="ta-panel border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{saveMessage}</div>
      ) : null}

      {!aiConfig ? (
        <div className="ta-panel p-5 text-sm text-slate-600">Loading AI settings…</div>
      ) : (
        <>
          <section className="ta-panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${modeBadgeClass(aiConfig.ai_mode)}`}
              >
                Current mode: {aiConfig.ai_mode === "real_openai" ? "Real OpenAI" : "Mock"}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Provider: {aiConfig.configured_provider}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                API key: {aiConfig.openai_api_key_status}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-slate-500">Model</dt>
                <dd className="font-medium text-slate-900">{aiConfig.real_provider_model ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Daily cost limit</dt>
                <dd className="font-medium text-slate-900">{formatCents(aiConfig.daily_cost_limit_cents)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Daily usage</dt>
                <dd className="font-medium text-slate-900">{formatCents(aiConfig.daily_usage_cents)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated by</dt>
                <dd className="font-medium text-slate-900">{aiConfig.last_updated_by ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated at</dt>
                <dd className="font-medium text-slate-900">
                  {aiConfig.last_updated_at ? new Date(aiConfig.last_updated_at).toLocaleString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">24h usage events</dt>
                <dd className="font-medium text-slate-900">{aiConfig.usage_summary.event_count}</dd>
              </div>
            </dl>
          </section>

          {readiness ? (
            <section className="ta-panel p-5">
              <h2 className="text-base font-semibold text-slate-900">AI readiness checklist</h2>
              <p className="mt-1 text-sm text-slate-600">
                Green means ready, yellow needs attention, and red blocks the end-to-end real AI path.
              </p>
              <div className="mt-4 space-y-2">
                {readiness.checks.map((check) => (
                  <div
                    key={check.key}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      check.status === "green"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : check.status === "yellow"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    <p className="font-medium text-slate-900">{check.label}</p>
                    <p className="mt-1 text-xs">{check.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="ta-panel p-5">
            <h2 className="text-base font-semibold text-slate-900">Configuration</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">AI mode</span>
                <select
                  className="ta-input mt-1 w-full"
                  value={aiProvider}
                  onChange={(event) => setAiProvider(event.target.value as "mock" | "openai")}
                >
                  <option value="mock">Mock</option>
                  <option value="openai">Real OpenAI</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Model</span>
                {aiConfig.allowed_models.length > 0 ? (
                  <select
                    className="ta-input mt-1 w-full"
                    value={realProviderModel}
                    onChange={(event) => setRealProviderModel(event.target.value)}
                  >
                    {aiConfig.allowed_models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="ta-input mt-1 w-full"
                    value={realProviderModel}
                    placeholder="e.g. gpt-4o-mini"
                    onChange={(event) => setRealProviderModel(event.target.value)}
                  />
                )}
              </label>

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Daily cost limit (cents)</span>
                <input
                  className="ta-input mt-1 w-full"
                  type="number"
                  min={0}
                  value={dailyCostLimitCents}
                  onChange={(event) => setDailyCostLimitCents(event.target.value)}
                />
              </label>

              <label className="flex items-center gap-3 pt-6 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={realProviderEnabled}
                  onChange={(event) => setRealProviderEnabled(event.target.checked)}
                />
                <span className="font-medium text-slate-700">Enable real OpenAI calls</span>
              </label>
            </div>

            {aiConfig.blockers.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Blockers</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {aiConfig.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="ta-button-primary"
                disabled={savePending}
                onClick={() => {
                  setSavePending(true);
                  setSaveMessage(null);
                  setError(null);
                  void updateV2AdminAiProviderConfig({
                    ai_provider: aiProvider,
                    real_provider_enabled: realProviderEnabled,
                    real_provider_model: realProviderModel || null,
                    daily_cost_limit_cents: Number.parseInt(dailyCostLimitCents, 10) || 0,
                  })
                    .then(async (config) => {
                      setAiConfig(config);
                      await refreshReadiness();
                      setSaveMessage("AI settings saved.");
                    })
                    .catch((nextError: Error) => setError(nextError.message))
                    .finally(() => setSavePending(false));
                }}
              >
                {savePending ? "Saving…" : "Save settings"}
              </button>

              <button
                type="button"
                className="ta-button-secondary"
                disabled={testPending}
                onClick={() => {
                  setTestPending(true);
                  setTestMessage(null);
                  setTestSuccess(null);
                  void testV2AdminAiProviderConnection()
                    .then((result) => {
                      setTestSuccess(result.success);
                      setTestMessage(result.message);
                    })
                    .catch((nextError: Error) => {
                      setTestSuccess(false);
                      setTestMessage(nextError.message);
                    })
                    .finally(() => setTestPending(false));
                }}
              >
                {testPending ? "Testing…" : "Test OpenAI connection"}
              </button>
            </div>

            {testMessage ? (
              <p
                className={`mt-3 text-sm ${testSuccess ? "text-emerald-700" : "text-rose-700"}`}
                role="status"
              >
                {testMessage}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
