"use client";

import { useCallback, useState } from "react";
import {
  fetchV2AssignmentClassInsight,
  createV2RecoveryQueueItem,
} from "@/lib/teacher-assist-v2-api";
import type { ClassInsight, RecoveryQueueItem } from "@/lib/teacher-assist-v2-types";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const RETEACH_COLORS: Record<string, string> = {
  whole_class: "bg-red-50 border-red-200 text-red-900",
  small_group: "bg-orange-50 border-orange-200 text-orange-900",
  individual_follow_up: "bg-yellow-50 border-yellow-200 text-yellow-900",
  insufficient_data: "bg-slate-50 border-slate-200 text-slate-600",
};

type Props = {
  assignmentId: string;
  packageId?: string | null;
  onQueueItemCreated?: (item: RecoveryQueueItem) => void;
};

export function TeacherAssistV2ClassInsightPanel({ assignmentId, packageId, onQueueItemCreated }: Props) {
  const [insight, setInsight] = useState<ClassInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [queueSuccess, setQueueSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchV2AssignmentClassInsight(assignmentId);
      setInsight(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load class insight.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  const handleAddToQueue = useCallback(async () => {
    if (!insight?.available || !insight.reteach_recommendation) return;
    setAddingToQueue(true);
    setQueueSuccess(null);
    try {
      const studentsAffected = (insight.students_needing_support ?? [])
        .map((s) => s.student_number)
        .filter((n): n is number => n !== null);

      const masterySnapshot = insight.mastery_distribution
        ? {
            total_students_assessed: insight.confirmed_grades_count,
            mastery_count: insight.mastery_distribution.mastery.count,
            developing_count: insight.mastery_distribution.developing.count,
            beginning_count: insight.mastery_distribution.beginning.count,
            mastery_percentage: insight.mastery_distribution.mastery.percent,
            average_percentage: insight.class_average_percentage ?? 0,
            most_common_misconception: insight.most_common_misconception?.text ?? null,
            misconception_frequency: insight.most_common_misconception?.frequency ?? 0,
            snapshot_at: insight.generated_at,
          }
        : null;

      const item = await createV2RecoveryQueueItem({
        recommendation_type: insight.reteach_recommendation.type === "individual_follow_up"
          ? "individual_follow_up"
          : insight.reteach_recommendation.type as "whole_class" | "small_group",
        reason: insight.reteach_recommendation.explanation,
        students_affected: studentsAffected,
        assignment_id: assignmentId,
        instructional_package_id: packageId ?? null,
        misconception_text: insight.most_common_misconception?.text ?? null,
        mastery_snapshot: masterySnapshot as Record<string, unknown> | null,
      });
      setQueueSuccess("Added to Recovery Queue.");
      onQueueItemCreated?.(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to queue.");
    } finally {
      setAddingToQueue(false);
    }
  }, [insight, assignmentId, packageId, onQueueItemCreated]);

  if (!insight && !loading && !error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Class Insight</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Aggregate analytics for this assignment, available after 3 confirmed grades.
            </p>
          </div>
          <button
            onClick={load}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Load Insight
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Class Insight</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-sky-600 hover:underline disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
      )}

      {loading && <p className="text-xs text-slate-500">Loading class insight…</p>}

      {insight && !insight.available && (
        <p className="text-xs text-slate-500">{insight.reason}</p>
      )}

      {insight?.available && (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-lg font-bold text-slate-900">
                {insight.class_average_percentage?.toFixed(1)}%
              </div>
              <div className="mt-0.5 text-xs text-slate-500">Class avg</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="text-lg font-bold text-emerald-800">
                {insight.mastery_distribution?.mastery.count ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-emerald-700">
                Mastery ({insight.mastery_distribution?.mastery.percent.toFixed(0)}%)
              </div>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
              <div className="text-lg font-bold text-rose-800">
                {(insight.students_needing_support?.length ?? 0)}
              </div>
              <div className="mt-0.5 text-xs text-rose-700">Need support</div>
            </div>
          </div>

          {/* Criterion strengths */}
          {(insight.strongest_criterion || insight.weakest_criterion) && (
            <div className="grid grid-cols-2 gap-2">
              {insight.strongest_criterion && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-semibold text-emerald-800">Strongest</p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    {insight.strongest_criterion.criterion}{" "}
                    <span className="font-semibold">
                      {insight.strongest_criterion.average_percentage.toFixed(0)}%
                    </span>
                  </p>
                </div>
              )}
              {insight.weakest_criterion && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                  <p className="text-xs font-semibold text-rose-800">Weakest</p>
                  <p className="mt-0.5 text-xs text-rose-700">
                    {insight.weakest_criterion.criterion}{" "}
                    <span className="font-semibold">
                      {insight.weakest_criterion.average_percentage.toFixed(0)}%
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Most common learning gap */}
          {insight.most_common_misconception && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900">Most common learning gap</p>
              <p className="mt-0.5 text-xs text-amber-800">
                {insight.most_common_misconception.text}{" "}
                <span className="text-amber-600">
                  ({insight.most_common_misconception.frequency} student
                  {insight.most_common_misconception.frequency === 1 ? "" : "s"},{" "}
                  {insight.most_common_misconception.percent_of_class.toFixed(0)}% of class)
                </span>
              </p>
            </div>
          )}

          {/* Objective breakdown */}
          {insight.objective_breakdown && insight.objective_breakdown.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Objective breakdown</p>
              <div className="space-y-1.5">
                {insight.objective_breakdown.map((obj) => (
                  <div key={obj.objective_id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800">
                        {obj.objective_code ?? "—"}{" "}
                        <span className="font-normal text-slate-500">
                          {obj.description ? `· ${obj.description.slice(0, 60)}${obj.description.length > 60 ? "…" : ""}` : ""}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          obj.mastery_percentage >= 80
                            ? "bg-emerald-100 text-emerald-800"
                            : obj.mastery_percentage >= 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {obj.mastery_percentage.toFixed(0)}% mastery
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-slate-500">
                      <span>{obj.mastery_count}M</span>
                      <span>{obj.developing_count}D</span>
                      <span>{obj.beginning_count}B</span>
                      <span>avg {obj.average_percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reteach recommendation + teacher action */}
          {insight.reteach_recommendation && (
            <div
              className={`rounded-xl border px-3 py-2 ${
                RETEACH_COLORS[insight.reteach_recommendation.type] ?? "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <p className="text-xs font-semibold">
                Recommended:{" "}
                {insight.reteach_recommendation.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p className="mt-0.5 text-xs">{insight.reteach_recommendation.explanation}</p>
              {insight.teacher_action_prompt && (
                <p className="mt-1.5 text-xs font-medium">{insight.teacher_action_prompt}</p>
              )}
            </div>
          )}

          {/* Students needing support */}
          {insight.students_needing_support && insight.students_needing_support.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Students needing support</p>
              <div className="flex flex-wrap gap-1.5">
                {insight.students_needing_support.map((s) => (
                  <span
                    key={s.student_number ?? Math.random()}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.mastery_level === "beginning"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                    title={s.suspected_misconception ?? undefined}
                  >
                    #{s.student_number} · {s.percentage?.toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add to Recovery Queue CTA */}
          {insight.reteach_recommendation &&
            insight.reteach_recommendation.type !== "insufficient_data" && (
              <div className="border-t border-slate-100 pt-3">
                {queueSuccess ? (
                  <p className="text-xs font-medium text-emerald-700">{queueSuccess}</p>
                ) : (
                  <button
                    onClick={handleAddToQueue}
                    disabled={addingToQueue}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {addingToQueue ? "Adding…" : "+ Add to Recovery Queue"}
                  </button>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Recovery Queue tracks this recommendation until you address it.
                </p>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
