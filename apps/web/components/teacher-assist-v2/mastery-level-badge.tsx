import {
  formatMasteryLevelLabel,
  formatMasteryLevelShort,
  masteryBadgeClass,
  normalizeMasteryLevel,
  resolveMasteryLevel,
} from "@/lib/teacher-assist-v2-mastery";

export function MasteryLevelBadge({
  level,
  label,
  percentage,
}: {
  level?: string | null;
  label?: string | null;
  percentage?: number | null;
}) {
  const resolvedLevel = normalizeMasteryLevel(level) ?? (percentage != null ? resolveMasteryLevel(percentage) : null);
  if (!resolvedLevel) {
    return <span className="text-slate-500">—</span>;
  }

  const displayLabel = label?.trim() || formatMasteryLevelLabel(resolvedLevel);
  const shortLabel = formatMasteryLevelShort(resolvedLevel);

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${masteryBadgeClass(resolvedLevel)}`}>
      {shortLabel !== "—" ? shortLabel : displayLabel}
    </span>
  );
}
