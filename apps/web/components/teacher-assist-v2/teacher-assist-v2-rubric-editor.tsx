"use client";

import { useEffect, useState } from "react";

import { updateV2PackageRubric } from "@/lib/teacher-assist-v2-api";
import type { InstructionalPackageArtifact, PackageRubricCriterion } from "@/lib/teacher-assist-v2-types";

function parseCriteria(artifact: InstructionalPackageArtifact): PackageRubricCriterion[] {
  const raw = artifact.content_json?.criteria;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      const points = Number(row.points ?? 0);
      const levels = Array.isArray(row.levels)
        ? row.levels.map((level) => String(level).trim()).filter(Boolean)
        : [];
      if (!name) return null;
      return {
        name,
        points: Number.isFinite(points) ? points : 0,
        levels: levels.length >= 2 ? levels : ["Meets expectations", "Partially meets", "Does not meet"],
      };
    })
    .filter((item): item is PackageRubricCriterion => item !== null);
}

export function TeacherAssistV2RubricEditor({
  packageId,
  artifact,
  onSaved,
}: {
  packageId: string;
  artifact: InstructionalPackageArtifact;
  onSaved: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(artifact.title);
  const [summary, setSummary] = useState(String(artifact.content_json?.summary ?? ""));
  const [description, setDescription] = useState(String(artifact.content_json?.description ?? ""));
  const [criteria, setCriteria] = useState<PackageRubricCriterion[]>(() => parseCriteria(artifact));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTitle(artifact.title);
    setSummary(String(artifact.content_json?.summary ?? ""));
    setDescription(String(artifact.content_json?.description ?? ""));
    setCriteria(parseCriteria(artifact));
  }, [artifact]);

  const totalPoints = criteria.reduce((sum, row) => sum + row.points, 0);

  const updateCriterion = (index: number, patch: Partial<PackageRubricCriterion>) => {
    setCriteria((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const updateLevel = (criterionIndex: number, levelIndex: number, value: string) => {
    setCriteria((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== criterionIndex) return row;
        const levels = [...row.levels];
        levels[levelIndex] = value;
        return { ...row, levels };
      }),
    );
  };

  const addCriterion = () => {
    setCriteria((current) => [
      ...current,
      {
        name: "New criterion",
        points: 4,
        levels: ["Meets expectations", "Partially meets", "Does not meet"],
      },
    ]);
  };

  const removeCriterion = (index: number) => {
    setCriteria((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateV2PackageRubric(packageId, artifact.id, {
        title: title.trim(),
        summary: summary.trim() || null,
        description: description.trim() || null,
        criteria,
      });
      setMessage("Rubric saved.");
      await onSaved();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save rubric.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-slate-100 px-4 py-4">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}

      <div className="grid gap-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Rubric title</span>
          <input className="ta-input h-9" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Summary</span>
          <input className="ta-input h-9" value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Writing assignment focus</span>
          <textarea
            className="ta-input min-h-[72px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">Criteria</p>
        <p className="text-xs text-slate-500">Total points: {totalPoints}</p>
      </div>

      <div className="space-y-3">
        {criteria.map((criterion, index) => (
          <div key={`${criterion.name}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_96px_auto]">
              <input
                className="ta-input h-9"
                value={criterion.name}
                onChange={(event) => updateCriterion(index, { name: event.target.value })}
              />
              <input
                type="number"
                min={0}
                className="ta-input h-9"
                value={criterion.points}
                onChange={(event) => updateCriterion(index, { points: Number(event.target.value) || 0 })}
              />
              <button type="button" className="ta-button-secondary h-9 px-3 text-xs" onClick={() => removeCriterion(index)}>
                Remove
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {criterion.levels.map((level, levelIndex) => (
                <label key={`${index}-${levelIndex}`} className="block space-y-1 text-xs">
                  <span className="font-medium text-slate-600">
                    {levelIndex === 0 ? "Strong" : levelIndex === 1 ? "Partial" : "Limited"}
                  </span>
                  <textarea
                    className="ta-input min-h-[64px] text-xs"
                    value={level}
                    onChange={(event) => updateLevel(index, levelIndex, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="ta-button-secondary h-9 px-3 text-sm" onClick={addCriterion}>
          Add criterion
        </button>
        <button type="button" className="ta-button-primary h-9 px-4 text-sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save rubric"}
        </button>
      </div>
    </div>
  );
}
