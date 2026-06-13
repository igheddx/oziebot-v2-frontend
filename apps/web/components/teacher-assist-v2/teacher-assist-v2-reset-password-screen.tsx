"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTeacherAssistV2 } from "@/components/teacher-assist-v2/teacher-assist-v2-context";
import { changePassword } from "@/lib/auth-service";

export function TeacherAssistV2ResetPasswordScreen() {
  const router = useRouter();
  const { refresh } = useTeacherAssistV2();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="max-w-lg space-y-4 text-left">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Create your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your administrator created your account with a temporary password. Choose a new password to continue.
        </p>
      </header>

      {formError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setFieldErrors({});
          setFormError(null);
          void changePassword({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
          })
            .then(async (result) => {
              await refresh();
              router.replace(result.landing_route ?? "/teacher-assist-v2/onboarding");
            })
            .catch((error: Error & { fieldErrors?: Record<string, string> }) => {
              if (error.fieldErrors) {
                setFieldErrors(error.fieldErrors);
                return;
              }
              setFormError(error.message || "Could not update password.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Temporary password</span>
          <input
            type="password"
            className={`ta-input h-9 ${fieldErrors.current_password ? "ta-input-error" : ""}`}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
          {fieldErrors.current_password ? (
            <span className="ta-field-error">{fieldErrors.current_password}</span>
          ) : null}
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">New password</span>
          <input
            type="password"
            className={`ta-input h-9 ${fieldErrors.new_password ? "ta-input-error" : ""}`}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
          {fieldErrors.new_password ? <span className="ta-field-error">{fieldErrors.new_password}</span> : null}
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Confirm new password</span>
          <input
            type="password"
            className={`ta-input h-9 ${fieldErrors.confirm_password ? "ta-input-error" : ""}`}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
          {fieldErrors.confirm_password ? (
            <span className="ta-field-error">{fieldErrors.confirm_password}</span>
          ) : null}
        </label>
        <button type="submit" className="ta-button-primary h-10 px-4 text-sm" disabled={busy}>
          {busy ? "Saving..." : "Save password and continue"}
        </button>
      </form>
    </div>
  );
}
