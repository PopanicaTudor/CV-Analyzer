const styles = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  processing: "bg-sky-50 text-sky-700 ring-sky-200",
  done: "bg-pink-50 text-pink-700 ring-pink-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

export default function StatusBadge({ status }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[status] || "bg-slate-50 text-slate-700 ring-slate-200"
      }`}
    >
      {label}
    </span>
  );
}
