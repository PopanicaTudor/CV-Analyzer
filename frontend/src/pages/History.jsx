import { FileClock, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client.js";
import EmptyState from "../components/EmptyState.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setItems(await api.history());
    } catch (exc) {
      setError(exc.message || "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteItem = async (item) => {
    const confirmed = window.confirm(`Delete ${item.filename}? This removes the uploaded file and saved analysis.`);
    if (!confirmed) {
      return;
    }

    setError("");
    setDeletingId(item.id);
    try {
      await api.deleteCV(item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (exc) {
      setError(exc.message || "Could not delete CV.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) =>
      [item.filename, item.status, item.predicted_category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [items, query]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-sky-100 bg-gradient-to-r from-sky-200 via-pink-100 to-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-white">
              <FileClock size={14} />
              Analysis archive
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">History</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              Review every uploaded CV, worker status, model score, and predicted career category.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </section>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-lg border border-sky-100 bg-white/85 p-5 shadow-soft">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-950">CV records</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredItems.length} visible records</p>
          </div>
          <label className="relative block w-full md:w-80">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search file, status, category"
              className="focus-ring w-full rounded-md border border-sky-100 bg-white/85 py-2.5 pl-9 pr-3 text-sm shadow-sm"
            />
          </label>
        </div>

        {loading ? (
          <div className="rounded-lg border border-sky-100 bg-white/70 p-5 text-sm text-slate-500">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <EmptyState title="No matching CVs" detail="Uploaded files will appear here with their processing status and score." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-sky-100 bg-white/75">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-100 text-sm">
                <thead className="bg-gradient-to-r from-sky-50 to-pink-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Career fit</th>
                    <th className="px-4 py-3">CV writing</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-50">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-sky-50/60">
                      <td className="max-w-[280px] truncate px-4 py-3 font-semibold text-slate-950">{item.filename}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <ScoreCell score={item.score} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <ScoreCell score={item.cv_quality_score} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.predicted_category || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(item.upload_date).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/cv/${item.id}`} className="font-semibold text-pink-700 hover:text-pink-800">
                            Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            disabled={deletingId === item.id}
                            className="focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            <Trash2 size={15} />
                            {deletingId === item.id ? "Deleting" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreCell({ score }) {
  if (score === null || score === undefined) {
    return <span>-</span>;
  }

  const value = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="min-w-[120px]">
      <div className="mb-1 text-xs font-semibold text-slate-700">{value}/100</div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-pink-400" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
