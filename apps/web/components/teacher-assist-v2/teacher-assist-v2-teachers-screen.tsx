"use client";

import { useEffect, useState } from "react";

import {
  fetchV2Districts,
  fetchV2Grades,
  fetchV2Schools,
  fetchV2States,
  fetchV2AdminTeachers,
  provisionV2Teacher,
} from "@/lib/teacher-assist-v2-api";
import type { AdminTeacherRow, EducationDistrictRow, EducationGradeRow, EducationSchoolRow, EducationStateRow } from "@/lib/teacher-assist-v2-types";

export function TeacherAssistV2TeachersScreen() {
  const [teachers, setTeachers] = useState<AdminTeacherRow[]>([]);
  const [states, setStates] = useState<EducationStateRow[]>([]);
  const [districts, setDistricts] = useState<EducationDistrictRow[]>([]);
  const [schools, setSchools] = useState<EducationSchoolRow[]>([]);
  const [grades, setGrades] = useState<EducationGradeRow[]>([]);
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refreshTeachers = () =>
    fetchV2AdminTeachers()
      .then(setTeachers)
      .catch((nextError: Error) => setError(nextError.message));

  useEffect(() => {
    void Promise.all([refreshTeachers(), fetchV2States(true)])
      .then(([, stateRows]) => setStates(stateRows))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!stateId) {
      setDistricts([]);
      setDistrictId("");
      return;
    }
    void fetchV2Districts(stateId, true).then(setDistricts);
  }, [stateId]);

  useEffect(() => {
    if (!districtId) {
      setSchools([]);
      setSchoolId("");
      return;
    }
    void fetchV2Schools(districtId, true).then(setSchools);
  }, [districtId]);

  useEffect(() => {
    if (!schoolId) {
      setGrades([]);
      setGradeId("");
      return;
    }
    void fetchV2Grades(schoolId, true).then(setGrades);
  }, [schoolId]);

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Teachers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create teacher accounts with a temporary password and school placement.
        </p>
      </header>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
      ) : null}
      {temporaryPassword ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Temporary password (shown once — share this with the teacher):</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-wide">{temporaryPassword}</span>
            <button
              type="button"
              className="rounded-lg border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
              onClick={() => void navigator.clipboard.writeText(temporaryPassword)}
            >
              Copy
            </button>
          </div>
          <p className="mt-1 text-xs">The teacher will be asked to set a new password on first login.</p>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Create teacher profile</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Full name</span>
            <input className="ta-input h-9" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            {fieldErrors.full_name ? <span className="ta-field-error">{fieldErrors.full_name}</span> : null}
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input className="ta-input h-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {fieldErrors.email ? <span className="ta-field-error">{fieldErrors.email}</span> : null}
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">State</span>
            <select className="ta-input h-9" value={stateId} onChange={(e) => setStateId(e.target.value)}>
              <option value="">Select state...</option>
              {states.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">District</span>
            <select className="ta-input h-9" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
              <option value="">Select district...</option>
              {districts.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">School</span>
            <select className="ta-input h-9" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Select school...</option>
              {schools.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Assigned grade (optional)</span>
            <select className="ta-input h-9" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">Teacher chooses during onboarding</option>
              {grades.map((row) => (
                <option key={row.id} value={row.id}>{row.display_name}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="ta-button-primary mt-3 h-10 px-4 text-sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            setMessage(null);
            setTemporaryPassword(null);
            setFieldErrors({});
            void provisionV2Teacher({
              email: email.trim(),
              full_name: fullName.trim(),
              state_id: stateId,
              district_id: districtId,
              school_id: schoolId,
              catalog_grade_id: gradeId || undefined,
            })
              .then(async (result) => {
                setMessage(
                  result.created_user
                    ? `Teacher account created for ${result.email}.`
                    : `Teacher access updated for ${result.email}. A new temporary password has been issued.`,
                );
                if (result.temporary_password) setTemporaryPassword(result.temporary_password);
                setEmail("");
                setFullName("");
                await refreshTeachers();
              })
              .catch((nextError: Error) => setError(nextError.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Creating..." : "Create teacher"}
        </button>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Teacher</th>
              <th className="px-4 py-2">School</th>
              <th className="px-4 py-2">Onboarding</th>
              <th className="px-4 py-2">Pacing guides</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-slate-500">Loading...</td></tr>
            ) : teachers.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-slate-500">No teachers provisioned yet.</td></tr>
            ) : (
              teachers.map((row) => (
                <tr key={row.assignment_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </td>
                  <td className="px-4 py-3">{row.school_name ?? "—"}</td>
                  <td className="px-4 py-3">{row.onboarding.onboarding_complete ? "Complete" : "Pending"}</td>
                  <td className="px-4 py-3">{row.onboarding.pacing_guide_setup_complete ? "Complete" : "Pending"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
