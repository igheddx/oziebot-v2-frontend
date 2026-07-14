"use client";

import Link from "next/link";

import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import type { InstructionalPackageSummary } from "@/lib/teacher-assist-v2-types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  processing: "bg-violet-50 text-violet-800 border-violet-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200",
  generated: "bg-sky-50 text-sky-800 border-sky-200",
  ending_soon: "bg-amber-50 text-amber-900 border-amber-200",
  expired: "bg-rose-50 text-rose-800 border-rose-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

export function InstructionalPackageCard({
  pkg,
  onMarkDone,
  onDelete,
}: {
  pkg: InstructionalPackageSummary;
  onMarkDone?: (packageId: string) => void;
  onDelete?: (packageId: string) => void;
}) {
  const weekLabel =
    pkg.week_start === pkg.week_end ? `Week ${pkg.week_start}` : `Weeks ${pkg.week_start}–${pkg.week_end}`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{pkg.title}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {pkg.subject_names.join(", ")} · {weekLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pkg.plan_start_date} – {pkg.plan_end_date}
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[pkg.status] ?? "bg-slate-50 text-slate-700 border-slate-200"
          }`}
        >
          {pkg.status.replaceAll("_", " ")}
        </span>
      </div>

      {pkg.status_message ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {pkg.status_message}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/teacher-assist-v2/packages/view?id=${encodeURIComponent(pkg.id)}`}
          className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
        >
          Open
        </Link>
        {pkg.download_url ? (
          <a
            href={resolveTeacherAssistFileUrl(pkg.download_url) ?? pkg.download_url}
            target="_blank"
            rel="noreferrer"
            className="ta-button-secondary inline-flex h-8 items-center px-3 text-xs"
          >
            Download
          </a>
        ) : null}
        {pkg.can_close_out && onMarkDone ? (
          <button type="button" className="ta-button-secondary h-8 px-3 text-xs" onClick={() => onMarkDone(pkg.id)}>
            Mark Done
          </button>
        ) : null}
        {onDelete && pkg.status !== "processing" ? (
          <button
            type="button"
            className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100"
            onClick={() => {
              if (window.confirm(`Delete "${pkg.title}"? This cannot be undone. Your AI cache will be preserved so regeneration will be fast.`)) {
                onDelete(pkg.id);
              }
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
