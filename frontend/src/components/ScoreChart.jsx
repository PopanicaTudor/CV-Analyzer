export default function ScoreChart({ score = 0, size = "default" }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const color = value >= 75 ? "#0891b2" : value >= 45 ? "#7c3aed" : "#db2777";
  const dimensions = size === "large" ? "h-64 min-w-[240px] max-w-[320px]" : "h-56 min-w-[220px] max-w-[280px]";
  const valueSize = size === "large" ? "text-6xl" : "text-5xl";

  return (
    <div className={`relative mx-auto w-full ${dimensions}`}>
      <div
        className="absolute inset-4 rounded-full"
        style={{
          background: `conic-gradient(${color} ${value * 3.6}deg, #e0f2fe 0deg)`,
        }}
      />
      <div className="absolute inset-9 rounded-full bg-white/90 shadow-inner" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`${valueSize} font-semibold tracking-normal text-slate-950`}>{value}</div>
        <div className="mt-1 text-sm font-medium text-slate-500">out of 100</div>
      </div>
    </div>
  );
}
