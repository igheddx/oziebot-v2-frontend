"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  createAiDiagnosticReview,
  fetchAiDiagnosticReview,
  fetchAiDiagnosticReviews,
  fetchAiDiagnosticSnapshots,
  updateAiDiagnosticFindingStatus,
  type AiDiagnosticFinding,
  type AiDiagnosticReviewDetail,
  type AiDiagnosticReviewSummary,
  type AiDiagnosticSnapshot,
} from "@/lib/admin-ai-diagnostics";

const STRATEGIES = ["all", "dca", "momentum", "day_trading", "reversion"] as const;
const MODES = [
  { value: "all", label: "Paper + live" },
  { value: "paper", label: "Paper" },
  { value: "live", label: "Live" },
] as const;

type FilterState = {
  snapshot_id: string;
  trading_mode: "paper" | "live" | "all";
  strategy: string;
  token: string;
  days: number;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatConfidence(value: number | null | undefined) {
  if (value == null) return "Unavailable";
  return `${Math.round(value * 100)}%`;
}

function metricLabel(label: string, value: string | number | null | undefined) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value ?? "Unavailable"}</p>
    </div>
  );
}

function badgeClass(value: string | null | undefined) {
  switch (value) {
    case "critical":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    case "warning":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "healthy":
    case "resolved":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
    case "acknowledged":
      return "border-sky-500/40 bg-sky-500/10 text-sky-100";
    case "dismissed":
      return "border-border bg-card text-muted";
    default:
      return "border-border bg-card text-foreground";
  }
}

export default function AdminAiDiagnosticsPage() {
  const { role } = useAuth();
  const isRootAdmin = role === "root_admin";
  const [filters, setFilters] = useState<FilterState>({
    snapshot_id: "",
    trading_mode: "all",
    strategy: "all",
    token: "",
    days: 7,
  });
  const [snapshots, setSnapshots] = useState<AiDiagnosticSnapshot[]>([]);
  const [reviews, setReviews] = useState<AiDiagnosticReviewSummary[]>([]);
  const [selectedReview, setSelectedReview] = useState<AiDiagnosticReviewDetail | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<AiDiagnosticFinding | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [actingFindingId, setActingFindingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isRootAdmin) return;
    setLoading(true);
    const [snapshotResponse, reviewResponse] = await Promise.all([
      fetchAiDiagnosticSnapshots(),
      fetchAiDiagnosticReviews(),
    ]);
    if (snapshotResponse.error) {
      setStatus(snapshotResponse.error);
      setLoading(false);
      return;
    }
    if (reviewResponse.error) {
      setStatus(reviewResponse.error);
      setLoading(false);
      return;
    }
    const nextSnapshots = snapshotResponse.data?.snapshots ?? [];
    const nextReviews = reviewResponse.data?.reviews ?? [];
    setSnapshots(nextSnapshots);
    setReviews(nextReviews);
    setStatus(null);
    if (!selectedReview && nextReviews[0]) {
      const detail = await fetchAiDiagnosticReview(nextReviews[0].id);
      if (detail.data) setSelectedReview(detail.data);
    }
    setLoading(false);
  }, [isRootAdmin, selectedReview]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = selectedReview;
  const findings = summary?.findings ?? [];

  const snapshotOptions = useMemo(
    () => [
      { id: "", label: "Latest matching data (new snapshot)" },
      ...snapshots.map((snapshot) => ({
        id: snapshot.id,
        label: `${formatDateTime(snapshot.generated_at)} · ${snapshot.trading_mode} · ${snapshot.strategy_filter}`,
      })),
    ],
    [snapshots],
  );

  const onRunReview = async () => {
    setRunning(true);
    const response = await createAiDiagnosticReview({
      snapshot_id: filters.snapshot_id || null,
      trading_mode: filters.trading_mode,
      strategy: filters.strategy,
      token: filters.token.trim() || null,
      days: filters.days,
    });
    if (response.error) {
      setStatus(response.error);
      setRunning(false);
      return;
    }
    const reviewId = response.data?.review_id;
    await load();
    if (reviewId) {
      const detail = await fetchAiDiagnosticReview(reviewId);
      if (detail.error) {
        setStatus(detail.error);
      } else {
        setSelectedReview(detail.data ?? null);
        setSelectedFinding(null);
        setStatus("AI diagnostic review completed.");
      }
    }
    setRunning(false);
  };

  const onOpenReview = async (reviewId: string) => {
    const response = await fetchAiDiagnosticReview(reviewId);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    setSelectedReview(response.data ?? null);
    setSelectedFinding(null);
    setStatus(null);
  };

  const onUpdateFinding = async (
    finding: AiDiagnosticFinding,
    nextStatus: "acknowledged" | "dismissed" | "resolved",
  ) => {
    setActingFindingId(finding.id);
    const response = await updateAiDiagnosticFindingStatus(finding.id, nextStatus);
    setActingFindingId(null);
    if (response.error) {
      setStatus(response.error);
      return;
    }
    const updated = response.data;
    if (!updated) return;
    setSelectedReview((current) =>
      current
        ? {
            ...current,
            findings: current.findings.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
    setSelectedFinding(updated);
  };

  if (!isRootAdmin) {
    return (
      <AppShell title="AI Diagnostic Review" subtitle="Root admin access is required.">
        <section className="oz-panel p-4 text-sm text-muted">
          This screen is only available to root admins because it exposes platform-wide diagnostic review history.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="AI Diagnostic Review"
      subtitle="Reviews trading diagnostics and highlights risks, anomalies, and recommended next actions."
      showModeToggle={false}
    >
      <section className="oz-panel space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Snapshot selector</p>
            <p className="text-xs text-muted">
              Choose a stored snapshot or run against the latest matching diagnostics data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onRunReview()}
            disabled={running}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            {running ? "Running AI review..." : "Run AI Review"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Snapshot
            <select
              value={filters.snapshot_id}
              onChange={(event) => setFilters((current) => ({ ...current, snapshot_id: event.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              {snapshotOptions.map((option) => (
                <option key={option.id || "latest"} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Trading mode
            <select
              value={filters.trading_mode}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  trading_mode: event.target.value as FilterState["trading_mode"],
                }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              {MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Strategy
            <select
              value={filters.strategy}
              onChange={(event) => setFilters((current) => ({ ...current, strategy: event.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              {STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy === "all" ? "All strategies" : strategy}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Token
            <input
              value={filters.token}
              onChange={(event) => setFilters((current) => ({ ...current, token: event.target.value.toUpperCase() }))}
              placeholder="All tokens"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Days
            <input
              type="number"
              min={1}
              max={365}
              value={filters.days}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  days: Math.min(365, Math.max(1, Number(event.target.value) || 7)),
                }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
        </div>

        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </section>

      {loading ? (
        <section className="grid gap-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {metricLabel("Overall health", summary?.overall_health ?? "No review")}
            {metricLabel("Findings", summary?.finding_count ?? 0)}
            {metricLabel("Critical", summary?.critical_count ?? 0)}
            {metricLabel("Warnings", summary?.warning_count ?? 0)}
            {metricLabel("Info items", summary?.info_count ?? 0)}
            {metricLabel("Confidence", formatConfidence(summary?.confidence_score))}
          </section>

          <section className="oz-panel space-y-4 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current review</p>
              <h2 className="text-lg font-semibold text-foreground">
                {summary ? summary.summary ?? "Review generated" : "No review selected"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Generated {formatDateTime(summary?.generated_at)} · Model {summary?.model_name ?? "rule-based"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Strategy</th>
                    <th className="px-3 py-2">Token</th>
                    <th className="px-3 py-2">Finding</th>
                    <th className="px-3 py-2">Recommendation</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Automation</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {findings.length ? (
                    findings.map((finding) => (
                      <tr
                        key={finding.id}
                        className="cursor-pointer hover:bg-card/70"
                        onClick={() => setSelectedFinding(finding)}
                      >
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(finding.severity)}`}>
                            {finding.severity}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted">{finding.category}</td>
                        <td className="px-3 py-3 text-muted">{finding.strategy ?? "All"}</td>
                        <td className="px-3 py-3 text-muted">{finding.token ?? "All"}</td>
                        <td className="px-3 py-3 font-medium text-foreground">{finding.finding_title}</td>
                        <td className="px-3 py-3 text-muted">{finding.recommendation}</td>
                        <td className="px-3 py-3 text-muted">{formatConfidence(finding.confidence_score)}</td>
                        <td className="px-3 py-3 text-muted">{finding.automation_eligibility}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(finding.status)}`}>
                            {finding.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-6 text-muted" colSpan={9}>
                        Run a review to see findings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="oz-panel space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Historical reviews</p>
              <p className="text-sm text-muted">Stored review runs remain available for later comparison.</p>
            </div>
            <div className="space-y-2">
              {reviews.length ? (
                reviews.map((review) => (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => void onOpenReview(review.id)}
                    className="flex w-full flex-col rounded-2xl border border-border bg-card/70 px-4 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{formatDateTime(review.generated_at)}</span>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(review.overall_health)}`}>
                        {review.overall_health ?? review.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{review.summary ?? "No summary"}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted">No AI diagnostic reviews have been stored yet.</p>
              )}
            </div>
          </section>
        </>
      )}

      {selectedFinding ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close details"
            className="absolute inset-0 bg-black/60"
            onClick={() => setSelectedFinding(null)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col gap-4 overflow-y-auto border-l border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{selectedFinding.category}</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{selectedFinding.finding_title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedFinding.strategy ?? "All strategies"} · {selectedFinding.token ?? "All tokens"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFinding(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/80 text-lg text-muted"
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(selectedFinding.severity)}`}>
                {selectedFinding.severity}
              </span>
              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(selectedFinding.status)}`}>
                {selectedFinding.status}
              </span>
            </div>

            <div className="space-y-4 text-sm">
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Full explanation</p>
                <p className="mt-2 text-foreground">{selectedFinding.finding_detail}</p>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommended action</p>
                <p className="mt-2 text-foreground">{selectedFinding.recommendation}</p>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Risk if ignored</p>
                <p className="mt-2 text-foreground">{selectedFinding.risk_if_ignored ?? "Unavailable"}</p>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Suggested owner / action</p>
                <p className="mt-2 text-foreground">
                  Trading systems engineering · inspect {selectedFinding.affected_strategy ?? "the pipeline"} for{" "}
                  {selectedFinding.affected_token ?? "the affected scope"}.
                </p>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Future phase notes</p>
                <p className="mt-2 text-foreground">
                  Automation eligibility: {selectedFinding.automation_eligibility}. Approval required:{" "}
                  {selectedFinding.approval_required ? "yes" : "no"}.
                </p>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Evidence from diagnostics JSON</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card/70 p-3 text-xs text-muted">
                  {JSON.stringify(selectedFinding.evidence_json, null, 2)}
                </pre>
              </section>
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Raw supporting metrics</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card/70 p-3 text-xs text-muted">
                  {JSON.stringify(
                    {
                      confidence_score: selectedFinding.confidence_score,
                      expected_impact: selectedFinding.expected_impact,
                      rollback_plan: selectedFinding.rollback_plan,
                      parameter_name: selectedFinding.parameter_name,
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {(["acknowledged", "dismissed", "resolved"] as const).map((nextStatus) => (
                <button
                  key={nextStatus}
                  type="button"
                  disabled={actingFindingId === selectedFinding.id || selectedFinding.status === nextStatus}
                  onClick={() => void onUpdateFinding(selectedFinding, nextStatus)}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  {actingFindingId === selectedFinding.id && selectedFinding.status !== nextStatus
                    ? "Updating..."
                    : `Mark ${nextStatus}`}
                </button>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}
