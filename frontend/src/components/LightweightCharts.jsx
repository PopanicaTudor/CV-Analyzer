function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function ScoreTrendChart({ data = [] }) {
  const width = 640;
  const height = 260;
  const padding = { top: 16, right: 18, bottom: 34, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const normalized = data.length ? data : [{ label: "No CVs", score: 0 }];
  const divisor = Math.max(1, normalized.length - 1);

  const points = normalized.map((item, index) => {
    const x = padding.left + (index / divisor) * chartWidth;
    const y = padding.top + chartHeight - (clamp(item.score) / 100) * chartHeight;
    return { ...item, x, y, score: clamp(item.score) };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  return (
    <div className="h-72 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Recent score trend">
        <defs>
          <linearGradient id="lightScoreArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padding.top + chartHeight - (tick / 100) * chartHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dbeafe" strokeDasharray="4 5" />
              <text x={10} y={y + 4} className="fill-slate-400 text-[11px]">
                {tick}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#lightScoreArea)" />
        <path d={linePath} fill="none" stroke="#ec4899" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="#38bdf8" stroke="white" strokeWidth="3" />
            <title>{`${point.label}: ${point.score}/100`}</title>
          </g>
        ))}
        {points.map((point, index) => (
          <text key={`${point.label}-label`} x={point.x} y={height - 10} textAnchor={index === 0 ? "start" : "middle"} className="fill-slate-500 text-[11px]">
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function KeywordWeightChart({ data = [] }) {
  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = clamp(item.weight);
        return (
          <div key={item.name} className="grid grid-cols-[minmax(96px,160px)_1fr_42px] items-center gap-3 text-sm">
            <div className="truncate font-semibold text-slate-700">{item.name}</div>
            <div className="h-3 overflow-hidden rounded-full bg-sky-50 ring-1 ring-sky-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: index % 2 === 0 ? "linear-gradient(90deg,#38bdf8,#818cf8)" : "linear-gradient(90deg,#f472b6,#fb7185)",
                }}
              />
            </div>
            <div className="text-right text-xs font-semibold text-slate-500">{width}</div>
          </div>
        );
      })}
    </div>
  );
}

export function JobSimilarityChart({ data = [] }) {
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = clamp(item.similarity);
        const semantic = item.semantic_similarity === null || item.semantic_similarity === undefined ? null : clamp(item.semantic_similarity);
        const lexical = item.lexical_similarity === null || item.lexical_similarity === undefined ? null : clamp(item.lexical_similarity);
        return (
          <div key={item.name} className="rounded-lg bg-white/70 p-3 ring-1 ring-pink-100">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold text-slate-800">{item.name}</div>
              <div className="text-xs font-semibold text-pink-700">{width}% combined</div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-pink-50">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-pink-400" style={{ width: `${width}%` }} />
            </div>
            {(semantic !== null || lexical !== null) && (
              <div className="mt-2 grid gap-2 text-[11px] font-semibold text-slate-500 sm:grid-cols-2">
                <div>Semantic {semantic ?? "n/a"}%</div>
                <div>TF-IDF {lexical ?? "n/a"}%</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
