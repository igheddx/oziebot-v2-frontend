export type MasteryLevel = "mastery" | "developing" | "beginning" | "missing";

const MASTERY_LEVELS = new Set<MasteryLevel>(["mastery", "developing", "beginning", "missing"]);

const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  mastery: "Mastery",
  developing: "Developing",
  beginning: "Beginning",
  missing: "Missing",
};

const MASTERY_LEVEL_SHORT_LABELS: Record<MasteryLevel, string> = {
  mastery: "M",
  developing: "D",
  beginning: "B",
  missing: "Mi",
};

export function resolveMasteryLevel(percentage: number): MasteryLevel {
  if (percentage >= 80) return "mastery";
  if (percentage >= 60) return "developing";
  return "beginning";
}

export function normalizeMasteryLevel(level: string | null | undefined): MasteryLevel | null {
  if (!level?.trim()) return null;
  const normalized = level.trim().toLowerCase() as MasteryLevel;
  return MASTERY_LEVELS.has(normalized) ? normalized : null;
}

export function formatMasteryLevelLabel(level: string | null | undefined): string {
  const normalized = normalizeMasteryLevel(level);
  if (normalized) return MASTERY_LEVEL_LABELS[normalized];
  if (level?.trim()) return level.trim();
  return "—";
}

export function formatMasteryLevelShort(level: string | null | undefined): string {
  const normalized = normalizeMasteryLevel(level);
  if (normalized) return MASTERY_LEVEL_SHORT_LABELS[normalized];
  return "—";
}

export function resolveMasteryLevelFields(
  percentage: number,
  masteryLevel?: string | null,
): { mastery_level: MasteryLevel; mastery_level_label: string } {
  const normalized = normalizeMasteryLevel(masteryLevel);
  if (normalized === "missing") {
    return { mastery_level: "missing", mastery_level_label: "Missing" };
  }
  const resolved = normalized ?? resolveMasteryLevel(percentage);
  return {
    mastery_level: resolved,
    mastery_level_label: MASTERY_LEVEL_LABELS[resolved],
  };
}

export function masteryBadgeClass(level: string | null | undefined): string {
  const normalized = normalizeMasteryLevel(level);
  if (normalized === "mastery") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (normalized === "developing") return "border-amber-200 bg-amber-50 text-amber-900";
  if (normalized === "beginning") return "border-rose-200 bg-rose-50 text-rose-800";
  if (normalized === "missing") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
