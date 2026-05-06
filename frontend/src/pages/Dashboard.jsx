import { Activity, BrainCircuit, FileCheck2, FileClock, Sparkles, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client.js";
import EmptyState from "../components/EmptyState.jsx";
import { ScoreTrendChart } from "../components/LightweightCharts.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .history()
      .then((data) => mounted && setItems(data))
      .catch((exc) => mounted && setError(exc.message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const done = items.filter((item) => item.status === "done");
    const average = done.length ? Math.round(done.reduce((sum, item) => sum + (item.score || 0), 0) / done.length) : 0;
    const qualityItems = done.filter((item) => item.cv_quality_score !== null && item.cv_quality_score !== undefined);
    const averageQuality = qualityItems.length
      ? Math.round(qualityItems.reduce((sum, item) => sum + (item.cv_quality_score || 0), 0) / qualityItems.length)
      : 0;
    return {
      total: items.length,
      done: done.length,
      average,
      averageQuality,
      active: items.filter((item) => item.status === "pending" || item.status === "processing").length,
      failed: items.filter((item) => item.status === "failed").length,
    };
  }, [items]);

  const chartData = useMemo(() => {
    const done = items
      .filter((item) => item.status === "done" && item.score !== null)
      .slice(0, 8)
      .reverse();
    if (!done.length) {
      return [{ label: "No CVs", score: 0 }];
    }
    return done.map((item) => ({
      label: `CV ${item.id}`,
      score: item.score,
    }));
  }, [items]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-sky-100 bg-gradient-to-r from-sky-200 via-pink-100 to-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-white">
              <Sparkles size={14} />
              Career intelligence dashboard
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              Monitor uploaded CVs, queue status, average model confidence, and recent career category predictions in one
              visual workspace.
            </p>
          </div>
          <Link
            to="/upload"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:from-sky-600 hover:to-pink-600"
          >
            <UploadCloud size={18} />
            Upload CV
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Uploaded CVs" value={stats.total} icon={FileClock} tone="sky" detail="Total files in your account" />
        <Stat label="Completed" value={stats.done} icon={FileCheck2} tone="pink" detail="Finished worker jobs" />
        <Stat label="Career fit avg." value={stats.average ? `${stats.average}/100` : "-"} icon={BrainCircuit} tone="violet" detail="Mean category confidence" />
        <Stat label="Writing avg." value={stats.averageQuality ? `${stats.averageQuality}/100` : "-"} icon={Activity} tone="amber" detail={`${stats.active} jobs in progress`} />
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-sky-100 bg-white/85 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Score trend</h2>
              <p className="mt-1 text-sm text-slate-500">Recent completed CV scores out of 100.</p>
            </div>
          </div>
          <ScoreTrendChart data={chartData} />
        </section>

        <section className="rounded-lg border border-pink-100 bg-gradient-to-br from-pink-100 via-white to-sky-50 p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Recent uploads</h2>
              <p className="mt-1 text-sm text-slate-500">Latest queue and scoring events.</p>
            </div>
            <Link to="/history" className="text-sm font-semibold text-pink-700 hover:text-pink-800">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="rounded-lg border border-sky-100 bg-white/70 p-5 text-sm text-slate-500">Loading...</div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No CVs uploaded yet"
              detail="Upload a PDF or DOCX CV and the worker will process it asynchronously."
              action={
                <Link
                  to="/upload"
                  className="focus-ring inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <UploadCloud size={18} />
                  Upload CV
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {items.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  to={`/cv/${item.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-white bg-white/75 px-4 py-3 shadow-sm hover:border-pink-100 hover:bg-white"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{item.filename}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(item.upload_date).toLocaleString()}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.score !== null && item.score !== undefined && (
                      <span className="text-sm font-semibold text-slate-950">{item.score}/100 fit</span>
                    )}
                    <StatusBadge status={item.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone, detail }) {
  const tones = {
    sky: "from-sky-100 to-white text-sky-700",
    pink: "from-pink-100 to-white text-pink-700",
    violet: "from-violet-100 to-white text-violet-700",
    amber: "from-amber-100 to-white text-amber-700",
  };

  return (
    <div className={`rounded-lg border border-white/80 bg-gradient-to-br ${tones[tone]} p-5 shadow-soft`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-600">{label}</div>
        <div className="rounded-md bg-white/75 p-2 shadow-sm">
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</div>
      <div className="mt-2 text-xs font-medium text-slate-500">{detail}</div>
    </div>
  );
}
