import { BrainCircuit, Database, MessageSquareMore, Send, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client.js";
import Dropzone from "../components/Dropzone.jsx";

const pipeline = [
  { title: "Store file", detail: "Django saves the uploaded PDF/DOCX metadata and file.", icon: Database },
  { title: "Queue job", detail: "RabbitMQ receives a durable processing message.", icon: MessageSquareMore },
  { title: "Analyze CV", detail: "Worker threads extract text, keywords, score, and matches.", icon: BrainCircuit },
];

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Select a CV file first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api.uploadCV(file);
      navigate(`/cv/${data.cv_id}`);
    } catch (exc) {
      setError(exc.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-lg border border-sky-100 bg-gradient-to-r from-sky-200 via-pink-100 to-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-white">
              <UploadCloud size={14} />
              Asynchronous CV intake
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">Upload CV</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              Send a CV into the processing pipeline. The API returns a CV ID immediately while the worker analyzes the
              file in the background.
            </p>
          </div>
          <div className="rounded-lg bg-white/70 px-4 py-3 text-sm font-semibold text-pink-800 ring-1 ring-white">
            PDF / DOCX up to 10 MB
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={submit} className="rounded-lg border border-sky-100 bg-white/85 p-5 shadow-soft">
          <Dropzone file={file} onFile={setFile} disabled={loading} />

          {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={!file || loading}
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-soft hover:from-sky-600 hover:to-pink-600 disabled:opacity-60"
            >
              <Send size={18} />
              {loading ? "Uploading..." : "Start analysis"}
            </button>
          </div>
        </form>

        <section className="rounded-lg border border-pink-100 bg-gradient-to-br from-pink-100 via-white to-sky-50 p-5 shadow-soft">
          <h2 className="text-base font-semibold text-slate-950">Pipeline preview</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">The demo shows each step again on the result page.</p>
          <div className="mt-5 space-y-3">
            {pipeline.map((step, index) => (
              <div key={step.title} className="rounded-lg bg-white/75 p-4 ring-1 ring-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-pink-400 text-white">
                    <step.icon size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Step {index + 1}</div>
                    <div className="text-sm font-semibold text-slate-950">{step.title}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
