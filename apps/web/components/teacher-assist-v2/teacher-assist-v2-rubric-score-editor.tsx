"use client";

import { useMemo } from "react";

import type { GradingDraft } from "@/lib/teacher-assist-v2-types";

export type RubricScoreSection = GradingDraft["rubric_json"]["sections"][number];

export function totalsFromRubricSections(sections: RubricScoreSection[]) {
  const score = sections.reduce((sum, row) => sum + Number(row.score || 0), 0);
  const maxScore = sections.reduce((sum, row) => sum + Number(row.max_score || 0), 0);
  return { score: Math.round(score * 100) / 100, maxScore: Math.round(maxScore * 100) / 100 };
}

export function TeacherAssistV2RubricScoreEditor({
  sections,
  onChange,
  readOnly = false,
}: {
  sections: RubricScoreSection[];
  onChange: (sections: RubricScoreSection[]) => void;
  readOnly?: boolean;
}) {
  const totals = useMemo(() => totalsFromRubricSections(sections), [sections]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rubric score card</h4>
        <p className="text-sm font-semibold text-slate-900">
          {totals.score}/{totals.maxScore}
        </p>
      </div>
      <ul className="space-y-2">
        {sections.map((section, index) => (
          <li key={`${section.name}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">{section.name}</p>
              {readOnly ? (
                <p className="text-slate-700">
                  {section.score}/{section.max_score}
                </p>
              ) : (
                <label className="flex items-center gap-1 text-slate-700">
                  <input
                    className="ta-input h-8 w-16"
                    type="number"
                    min={0}
                    max={section.max_score}
                    step="0.5"
                    value={section.score}
                    onChange={(event) => {
                      const next = [...sections];
                      next[index] = { ...section, score: Number(event.target.value) };
                      onChange(next);
                    }}
                  />
                  <span>/ {section.max_score}</span>
                </label>
              )}
            </div>
            {readOnly ? (
              <p className="mt-1 text-slate-600">{section.feedback}</p>
            ) : (
              <textarea
                className="ta-input mt-2 min-h-16 w-full"
                value={section.feedback}
                placeholder="Criterion feedback"
                onChange={(event) => {
                  const next = [...sections];
                  next[index] = { ...section, feedback: event.target.value };
                  onChange(next);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
