type GrowthChartProps = {
  values: number[];
  positive: boolean;
};

export function GrowthChart({ values, positive }: GrowthChartProps) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  const points = values
    .map((value, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / spread) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="oz-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Growth Trend</h2>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            positive ? "bg-positive/20 text-positive" : "bg-negative/20 text-negative"
          }`}
        >
          12H
        </span>
      </div>
      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border/80 bg-surface/60 p-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            fill="none"
            stroke={positive ? "rgb(46 217 164)" : "rgb(255 111 111)"}
            strokeWidth="2.8"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
}
