type PlaceholderProps = {
  title: string;
  description: string;
};

export function TeacherAssistV2PlaceholderScreen({ title, description }: PlaceholderProps) {
  return (
    <div className="space-y-5">
      <section className="ta-panel p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Coming soon</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This area is intentionally scoped out of Prompt 1. Legacy features remain in code but are hidden
          from the v2 navigation.
        </div>
      </section>
    </div>
  );
}
