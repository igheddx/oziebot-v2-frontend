export default function TeacherAssistV2AccessDeniedPage() {
  return (
    <div className="ta-panel w-full max-w-lg p-6 text-left">
      <h1 className="text-2xl font-semibold text-slate-900">Access denied</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Your account does not have TeacherAssist access. Contact a platform administrator if you believe this
        is an error.
      </p>
    </div>
  );
}
