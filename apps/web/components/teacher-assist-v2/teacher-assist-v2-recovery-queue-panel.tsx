"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchV2RecoveryQueue,
  updateV2RecoveryQueueItem,
  fetchV2RecoveryBudget,
  generateV2RecoveryArtifact,
  fetchV2RecoveryArtifacts,
} from "@/lib/teacher-assist-v2-api";
import type { RecoveryQueueItem, RecoveryBudget, RecoveryArtifact } from "@/lib/teacher-assist-v2-types";

// ── Constants ──────────────────────────────────────────────────────────────────

const RESPONSE_OPTIONS: { value: string; label: string }[] = [
  { value: "embedded_review", label: "Embedded Review (~10 min)" },
  { value: "bell_ringer", label: "Bell Ringer (~8 min)" },
  { value: "small_group", label: "Small Group (~20 min)" },
  { value: "whole_class_recovery", label: "Whole-Class Recovery (~45 min)" },
  { value: "spiral_review", label: "Spiral Review (future week)" },
  { value: "conference", label: "Conference (10 min/student)" },
  { value: "homework_reinforcement", label: "Homework Reinforcement" },
  { value: "defer", label: "Defer — revisit later" },
  { value: "dismiss", label: "Dismiss — will not address" },
];

// Maps teacher_response value → recommended artifact type for generation
const RESPONSE_TO_ARTIFACT: Record<string, string> = {
  bell_ringer: "recovery_bell_ringer",
  embedded_review: "recovery_mini_lesson",
  small_group: "recovery_small_group_packet",
  whole_class_recovery: "recovery_presentation",
  spiral_review: "recovery_spiral_review",
  conference: "recovery_conference_guide",
  homework_reinforcement: "recovery_homework",
};

const ARTIFACT_DISPLAY_LABELS: Record<string, string> = {
  recovery_bell_ringer: "Bell Ringer",
  recovery_mini_lesson: "Mini Lesson",
  recovery_small_group_packet: "Small Group Packet",
  recovery_conference_guide: "Conference Guide",
  recovery_exit_ticket: "Exit Ticket",
  recovery_guided_practice: "Guided Practice",
  recovery_assignment: "Assignment",
  recovery_homework: "Homework",
  recovery_assessment: "Assessment",
  recovery_spiral_review: "Spiral Review Schedule",
  recovery_presentation: "Recovery Lesson",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  scheduled: "bg-sky-100 text-sky-800",
  deferred: "bg-slate-100 text-slate-600",
  completed: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-slate-100 text-slate-400",
};

const PACING_IMPACT_COLORS: Record<string, string> = {
  low: "text-emerald-700",
  moderate: "text-yellow-700",
  high: "text-orange-700",
  critical: "text-red-700",
};

// Maps timeline_phase to the four visible stages (1–4 checkpoints)
const PHASE_STAGE: Record<string, number> = {
  recovery_goal: 1,
  recovery_activity: 2,
  recovery_verification: 3,
  recovery_outcome: 4,
};

const STAGE_LABELS = ["Goal", "Activity", "Verification", "Outcome"];

function paceColor(label: string) {
  const l = label.toLowerCase();
  if (l.startsWith("critical")) return PACING_IMPACT_COLORS.critical;
  if (l.startsWith("high")) return PACING_IMPACT_COLORS.high;
  if (l.startsWith("moderate")) return PACING_IMPACT_COLORS.moderate;
  return PACING_IMPACT_COLORS.low;
}

// ── 4-Stage progress indicator ─────────────────────────────────────────────────

function StagePipeline({ phase }: { phase: string | null }) {
  const currentStage = PHASE_STAGE[phase ?? "recovery_goal"] ?? 1;
  return (
    <div className="flex items-center gap-1">
      {STAGE_LABELS.map((label, i) => {
        const stage = i + 1;
        const done = stage < currentStage;
        const active = stage === currentStage;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                    ? "bg-sky-500 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {done ? "✓" : stage}
              </div>
              <span
                className={`text-[9px] ${
                  active ? "font-semibold text-sky-700" : done ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div
                className={`mb-3 h-px w-5 ${done ? "bg-emerald-400" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Artifact card ──────────────────────────────────────────────────────────────

function ArtifactCard({ artifact }: { artifact: RecoveryArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const label = ARTIFACT_DISPLAY_LABELS[artifact.artifact_type] ?? artifact.artifact_type;

  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-sky-800">{artifact.title}</p>
          <p className="text-xs text-sky-600">
            {label} · {artifact.provider === "deterministic" ? "Deterministic" : `AI (${artifact.model ?? artifact.provider})`}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-sky-600 hover:underline"
        >
          {expanded ? "Hide" : "View"}
        </button>
      </div>

      {artifact.validation_result?.warnings && artifact.validation_result.warnings.length > 0 && (
        <p className="mt-1 text-[10px] text-amber-600">
          {artifact.validation_result.warnings[0]}
        </p>
      )}

      {expanded && artifact.content != null && (
        <div className="mt-2 space-y-1.5">
          {Object.entries(artifact.content).map(([key, value]) => {
            if (key === "injection_metadata" || key === "completion_tracking") return null;
            const displayKey = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            if (typeof value === "string" && value) {
              return (
                <div key={key} className="rounded-md border border-sky-100 bg-white p-2">
                  <p className="text-[10px] font-semibold text-slate-500">{displayKey}</p>
                  <p className="mt-0.5 text-xs text-slate-800">{value}</p>
                </div>
              );
            }
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
              return (
                <div key={key} className="rounded-md border border-sky-100 bg-white p-2">
                  <p className="text-[10px] font-semibold text-slate-500">{displayKey}</p>
                  {Object.entries(value as Record<string, unknown>).map(([k, v]) =>
                    typeof v === "string" && v ? (
                      <p key={k} className="mt-0.5 text-xs text-slate-700">
                        <span className="font-medium">{k.replace(/_/g, " ")}: </span>
                        {String(v)}
                      </p>
                    ) : null,
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// ── Recovery queue item card ───────────────────────────────────────────────────

function RecoveryQueueItemCard({
  item,
  onUpdate,
}: {
  item: RecoveryQueueItem;
  onUpdate: (updated: RecoveryQueueItem) => void;
}) {
  const [expanding, setExpanding] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(item.teacher_response ?? "");
  const [scheduledFor, setScheduledFor] = useState(item.scheduled_for ?? "");
  const [notes, setNotes] = useState(item.teacher_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Artifact generation state
  const [artifacts, setArtifacts] = useState<RecoveryArtifact[]>([]);
  const [artifactsLoaded, setArtifactsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const isTerminal = item.status === "completed" || item.status === "dismissed";

  const handleSave = useCallback(async () => {
    if (!selectedResponse) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateV2RecoveryQueueItem(item.id, {
        teacher_response: selectedResponse || null,
        scheduled_for: scheduledFor || null,
        teacher_notes: notes || null,
      });
      onUpdate(updated);
      setExpanding(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [item.id, selectedResponse, scheduledFor, notes, onUpdate]);

  const handleMarkComplete = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateV2RecoveryQueueItem(item.id, { status: "completed" });
      onUpdate(updated);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }, [item.id, onUpdate]);

  const loadArtifacts = useCallback(async () => {
    try {
      const data = await fetchV2RecoveryArtifacts(item.id);
      setArtifacts(data);
      setArtifactsLoaded(true);
    } catch {
      setArtifactsLoaded(true);
    }
  }, [item.id]);

  const handleGenerate = useCallback(async () => {
    const artifactType =
      RESPONSE_TO_ARTIFACT[item.teacher_response ?? ""] ?? "recovery_mini_lesson";
    setGenerating(true);
    setGenerateError(null);
    try {
      const artifact = await generateV2RecoveryArtifact(item.id, artifactType);
      setArtifacts((prev) => [...prev, artifact]);
      setArtifactsLoaded(true);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate artifact.");
    } finally {
      setGenerating(false);
    }
  }, [item.id, item.teacher_response]);

  // Load artifacts when the item is scheduled and we expand
  useEffect(() => {
    if (item.status === "scheduled" && !artifactsLoaded) {
      loadArtifacts();
    }
  }, [item.status, artifactsLoaded, loadArtifacts]);

  const recommendedArtifactLabel =
    item.teacher_response
      ? ARTIFACT_DISPLAY_LABELS[RESPONSE_TO_ARTIFACT[item.teacher_response] ?? ""] ?? null
      : null;

  return (
    <div
      className={`rounded-xl border p-3 ${
        item.status === "dismissed"
          ? "border-slate-100 bg-slate-50 opacity-60"
          : item.best_before_at_risk
          ? "border-orange-200 bg-orange-50"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Header: priority + status + objective + best_before */}
      <div className="flex flex-wrap items-start gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            PRIORITY_COLORS[item.priority] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {item.priority}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {item.status}
        </span>
        {item.objective_code && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
            {item.objective_code}
          </span>
        )}
        {item.best_before_at_risk && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
            ⚠ Before {item.best_before}
          </span>
        )}
        {item.best_before && !item.best_before_at_risk && (
          <span className="text-xs text-slate-400">Before {item.best_before}</span>
        )}
      </div>

      {/* 4-stage pipeline */}
      {item.timeline_phase && (
        <div className="mt-2">
          <StagePipeline phase={item.timeline_phase} />
        </div>
      )}

      {/* Recommendation + students */}
      <p className="mt-2 text-xs font-semibold text-slate-800">
        {item.recommendation_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        {item.students_affected_count > 0 && (
          <span className="ml-1 font-normal text-slate-500">
            · {item.students_affected_count} student{item.students_affected_count === 1 ? "" : "s"}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{item.reason}</p>

      {item.misconception_text && (
        <p className="mt-1 text-xs text-amber-700">
          <span className="font-medium">Learning gap:</span> {item.misconception_text}
        </p>
      )}

      {/* Recovery goal from success criteria */}
      {item.success_criteria != null && !!(item.success_criteria as Record<string, unknown>).specific_gap_to_close && (
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-medium">Recovery goal:</span>{" "}
          {String((item.success_criteria as Record<string, unknown>).specific_gap_to_close)}
        </p>
      )}

      {item.teacher_response && (
        <p className="mt-1 text-xs text-sky-700">
          <span className="font-medium">Response:</span>{" "}
          {RESPONSE_OPTIONS.find((o) => o.value === item.teacher_response)?.label ??
            item.teacher_response}
          {item.scheduled_for && ` · ${item.scheduled_for}`}
        </p>
      )}

      {saveError && <p className="mt-1 text-xs text-rose-700">{saveError}</p>}

      {/* Action buttons */}
      {!isTerminal && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!expanding && (
            <button
              onClick={() => setExpanding(true)}
              className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100"
            >
              Respond
            </button>
          )}
          {item.status === "scheduled" && item.teacher_response && recommendedArtifactLabel && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
            >
              {generating
                ? "Generating…"
                : `Generate ${recommendedArtifactLabel}`}
            </button>
          )}
          {item.status === "scheduled" && (
            <button
              onClick={handleMarkComplete}
              disabled={saving}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {saving ? "…" : "Mark complete"}
            </button>
          )}
        </div>
      )}

      {generateError && <p className="mt-1 text-xs text-rose-700">{generateError}</p>}

      {/* Generated artifacts */}
      {artifacts.length > 0 && (
        <div className="mt-3 space-y-2">
          {artifacts.map((a) => (
            <ArtifactCard key={a.id} artifact={a} />
          ))}
        </div>
      )}

      {/* Response form */}
      {expanding && !isTerminal && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Recovery strategy</label>
            <select
              value={selectedResponse}
              onChange={(e) => setSelectedResponse(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
            >
              <option value="">Select a strategy…</option>
              {RESPONSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {selectedResponse &&
            selectedResponse !== "defer" &&
            selectedResponse !== "dismiss" &&
            selectedResponse !== "homework_reinforcement" && (
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Schedule for (optional)
                </label>
                <input
                  type="date"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
                />
              </div>
            )}
          <div>
            <label className="text-xs font-semibold text-slate-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any context or reminders for yourself…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!selectedResponse || saving}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save response"}
            </button>
            <button
              onClick={() => setExpanding(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
          {saveError && <p className="text-xs text-rose-700">{saveError}</p>}
        </div>
      )}
    </div>
  );
}

// ── Budget summary ─────────────────────────────────────────────────────────────

function RecoveryBudgetSummary({ budget }: { budget: RecoveryBudget }) {
  if (!budget.budget_available) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">{budget.reason ?? "Budget unavailable."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">Recovery Budget</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <div className="text-sm font-bold text-slate-900">
            {budget.remaining_instructional_days}
          </div>
          <div className="text-xs text-slate-500">days left</div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <div className="text-sm font-bold text-slate-900">
            {budget.estimated_recovery_minutes} min
          </div>
          <div className="text-xs text-slate-500">queued recovery</div>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <div className={`text-sm font-bold ${paceColor(budget.pacing_impact_label ?? "")}`}>
            {budget.pacing_impact_percent?.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500">pacing impact</div>
        </div>
      </div>

      {budget.pacing_impact_label && (
        <p className={`text-xs font-medium ${paceColor(budget.pacing_impact_label)}`}>
          {budget.pacing_impact_label}
        </p>
      )}

      {budget.trade_off_analysis?.available &&
        (budget.trade_off_analysis.total_displaced_minutes ?? 0) > 0 && (
          <p className="text-xs text-slate-500">
            ~{budget.trade_off_analysis.total_displaced_minutes} min of instructional time may be
            displaced across queued recovery sessions.
          </p>
        )}

      <p className="text-xs text-slate-400">{budget.budget_note}</p>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

type Props = {
  assignmentId?: string;
  packageId?: string | null;
  refreshTrigger?: number;
};

export function TeacherAssistV2RecoveryQueuePanel({
  assignmentId,
  packageId,
  refreshTrigger,
}: Props) {
  const [items, setItems] = useState<RecoveryQueueItem[]>([]);
  const [budget, setBudget] = useState<RecoveryBudget | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allStatuses = showCompleted
        ? "pending,scheduled,deferred,completed,dismissed"
        : "pending,scheduled,deferred";
      const [queueData, budgetData] = await Promise.all([
        fetchV2RecoveryQueue({
          assignment_id: assignmentId,
          instructional_package_id: packageId ?? undefined,
          status: allStatuses,
        }),
        packageId ? fetchV2RecoveryBudget(packageId) : Promise.resolve(null),
      ]);
      setItems(queueData);
      setBudget(budgetData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recovery queue.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId, packageId, showCompleted]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const handleItemUpdate = useCallback((updated: RecoveryQueueItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  const activeItems = items.filter((i) =>
    ["pending", "scheduled", "deferred"].includes(i.status),
  );
  const completedItems = items.filter((i) =>
    ["completed", "dismissed"].includes(i.status),
  );

  if (!loading && items.length === 0 && !error) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recovery Queue</h2>
          {activeItems.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              {activeItems.length} active item{activeItems.length === 1 ? "" : "s"} · Goal → Activity → Verification → Outcome
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-sky-600 hover:underline disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}

      {activeItems.length > 0 && (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <RecoveryQueueItemCard key={item.id} item={item} onUpdate={handleItemUpdate} />
          ))}
        </div>
      )}

      {budget && <RecoveryBudgetSummary budget={budget} />}

      {completedItems.length > 0 || !showCompleted ? (
        <button
          onClick={() => setShowCompleted((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
        >
          {showCompleted
            ? `Hide completed (${completedItems.length})`
            : `Show completed (${completedItems.length})`}
        </button>
      ) : null}

      {showCompleted && completedItems.length > 0 && (
        <div className="space-y-2">
          {completedItems.map((item) => (
            <RecoveryQueueItemCard key={item.id} item={item} onUpdate={handleItemUpdate} />
          ))}
        </div>
      )}
    </section>
  );
}
