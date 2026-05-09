"use client";

import { authFetch, parseErrorMessage } from "@/lib/auth-service";

export type AiDiagnosticSnapshot = {
  id: string;
  generated_at: string;
  trading_mode: string;
  strategy_filter: string;
  token_filter: string | null;
  days_filter: number;
  created_at: string;
};

export type AiDiagnosticFinding = {
  id: string;
  review_id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  strategy: string | null;
  token: string | null;
  finding_title: string;
  finding_detail: string;
  evidence_json: Record<string, unknown>;
  recommendation: string;
  risk_if_ignored: string | null;
  confidence_score: number | null;
  automation_eligibility:
    | "not_eligible"
    | "future_human_approval_required"
    | "future_auto_tune_candidate";
  status: "new" | "acknowledged" | "dismissed" | "resolved";
  future_config_change_candidate: boolean;
  proposed_config_change_json: Record<string, unknown> | null;
  approval_required: boolean;
  eligible_for_auto_tune: boolean;
  rollback_plan: string | null;
  expected_impact: string | null;
  risk_level: string | null;
  affected_strategy: string | null;
  affected_token: string | null;
  parameter_name: string | null;
  current_value_json: Record<string, unknown> | null;
  proposed_value_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AiDiagnosticReviewSummary = {
  id: string;
  snapshot_id: string;
  status: "queued" | "running" | "completed" | "failed";
  overall_health: "healthy" | "warning" | "critical" | null;
  confidence_score: number | null;
  summary: string | null;
  model_name: string;
  prompt_version: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  finding_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  status_counts: Record<string, number>;
};

export type AiDiagnosticReviewDetail = AiDiagnosticReviewSummary & {
  snapshot: AiDiagnosticSnapshot;
  snapshot_raw_json: Record<string, unknown>;
  findings: AiDiagnosticFinding[];
};

export type CreateAiReviewInput = {
  snapshot_id?: string | null;
  trading_mode: "paper" | "live" | "all";
  strategy: string;
  token?: string | null;
  days: number;
};

async function readJson<T>(path: string, init?: RequestInit): Promise<{ data?: T; error?: string }> {
  const res = await authFetch(path, init);
  if (!res) return { error: "Could not reach API." };
  if (!res.ok) return { error: await parseErrorMessage(res) };
  return { data: (await res.json()) as T };
}

export async function fetchAiDiagnosticSnapshots() {
  return readJson<{ snapshots: AiDiagnosticSnapshot[] }>("/v1/admin/ai-diagnostics/snapshots");
}

export async function createAiDiagnosticReview(input: CreateAiReviewInput) {
  return readJson<{ review_id: string; status: "queued" | "running" | "completed" | "failed" }>(
    "/v1/admin/ai-diagnostics/reviews",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function fetchAiDiagnosticReviews() {
  return readJson<{ reviews: AiDiagnosticReviewSummary[] }>("/v1/admin/ai-diagnostics/reviews");
}

export async function fetchAiDiagnosticReview(reviewId: string) {
  return readJson<AiDiagnosticReviewDetail>(`/v1/admin/ai-diagnostics/reviews/${reviewId}`);
}

export async function updateAiDiagnosticFindingStatus(
  findingId: string,
  status: "acknowledged" | "dismissed" | "resolved",
) {
  return readJson<AiDiagnosticFinding>(`/v1/admin/ai-diagnostics/findings/${findingId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
