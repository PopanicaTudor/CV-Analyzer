export default function EmptyState({ title, detail, action }) {
  return (
    <div className="rounded-lg border border-dashed border-sky-200 bg-gradient-to-br from-sky-50 via-white to-pink-50 p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-pink-400 text-lg font-bold text-white">
        AI
      </div>
      <div className="text-base font-semibold text-slate-950">{title}</div>
      {detail && <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{detail}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
