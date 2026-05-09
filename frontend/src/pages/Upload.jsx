import { BrainCircuit, BriefcaseBusiness, Database, MessageSquareMore, Plus, Send, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client.js";
import Dropzone from "../components/Dropzone.jsx";

const pipeline = [
  { title: "Store file", detail: "Django saves the uploaded PDF/DOCX metadata and file.", icon: Database },
  { title: "Capture targets", detail: "The requested jobs are saved with the CV and sent to the worker.", icon: BriefcaseBusiness },
  { title: "Queue job", detail: "RabbitMQ receives a durable processing message.", icon: MessageSquareMore },
  { title: "Analyze CV", detail: "Worker compares the CV against both market jobs and your target jobs.", icon: BrainCircuit },
];

const MAX_TARGET_JOBS = 5;

function emptyTargetJob() {
  return { title: "", description: "" };
}

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [targetJobs, setTargetJobs] = useState([emptyTargetJob()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateTargetJob = (index, field, value) => {
    setTargetJobs((current) =>
      current.map((target, targetIndex) => (targetIndex === index ? { ...target, [field]: value } : target)),
    );
  };

  const addTargetJob = () => {
    setTargetJobs((current) => (current.length >= MAX_TARGET_JOBS ? current : [...current, emptyTargetJob()]));
  };

  const removeTargetJob = (index) => {
    setTargetJobs((current) => {
      const next = current.filter((_, targetIndex) => targetIndex !== index);
      return next.length ? next : [emptyTargetJob()];
    });
  };

  const normalizedTargetJobs = targetJobs
    .map((target) => ({
      title: target.title.trim(),
      description: target.description.trim(),
    }))
    .filter((target) => target.title || target.description);

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Select a CV file first.");
      return;
    }
    if (!normalizedTargetJobs.length) {
      setError("Add at least one target job for the CV analysis.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api.uploadCV(file, normalizedTargetJobs);
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

          <section className="mt-5 rounded-lg border border-sky-100 bg-white/75 p-4">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <BriefcaseBusiness size={18} className="text-sky-700" />
                  Target jobs
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Add the roles you want the CV to signal. A short title is enough; details make the comparison sharper.
                </p>
              </div>
              <button
                type="button"
                onClick={addTargetJob}
                disabled={loading || targetJobs.length >= MAX_TARGET_JOBS}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
              >
                <Plus size={17} />
                Add job
              </button>
            </div>

            <div className="space-y-3">
              {targetJobs.map((target, index) => (
                <div key={index} className="rounded-lg bg-white/85 p-3 ring-1 ring-sky-100">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Target {index + 1}</div>
                    <button
                      type="button"
                      onClick={() => removeTargetJob(index)}
                      disabled={loading || targetJobs.length === 1}
                      className="focus-ring rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove target job ${index + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Job title</span>
                    <input
                      value={target.title}
                      onChange={(event) => updateTargetJob(index, "title", event.target.value)}
                      placeholder="Example: Junior Backend Developer"
                      maxLength={120}
                      disabled={loading}
                      className="focus-ring mt-1 w-full rounded-md border border-sky-100 bg-white px-3 py-2.5 text-sm shadow-sm"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-sm font-semibold text-slate-700">Expected signals or job description</span>
                    <textarea
                      value={target.description}
                      onChange={(event) => updateTargetJob(index, "description", event.target.value)}
                      placeholder="Tools, responsibilities, domain, seniority, or the pasted job description."
                      rows={3}
                      maxLength={1500}
                      disabled={loading}
                      className="focus-ring mt-1 w-full resize-y rounded-md border border-sky-100 bg-white px-3 py-2.5 text-sm leading-6 shadow-sm"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={!file || !normalizedTargetJobs.length || loading}
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
