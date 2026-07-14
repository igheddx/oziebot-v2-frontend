"use client";

import { useEffect } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TeacherAssistV2ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel = "Yes, remove",
  cancelLabel = "No, keep it",
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ta-v2-confirm-title"
        aria-describedby="ta-v2-confirm-message"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 4.5 2.5 18a1.5 1.5 0 0 0 1.3 2.25h16.4a1.5 1.5 0 0 0 1.3-2.25L13.7 4.5a1.5 1.5 0 0 0-2.6 0Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="ta-v2-confirm-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <p id="ta-v2-confirm-message" className="mt-2 text-sm leading-relaxed text-slate-600">
              {message}
            </p>
            {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="ta-button-secondary h-10 px-4 text-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`h-10 px-4 text-sm font-medium rounded-lg ${
              destructive
                ? "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800"
                : "ta-button-primary"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
