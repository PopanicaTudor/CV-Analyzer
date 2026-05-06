import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "../api/client.js";
import KeywordHighlighter from "../components/KeywordHighlighter.jsx";
import { JobSimilarityChart, KeywordWeightChart } from "../components/LightweightCharts.jsx";
import ScoreChart from "../components/ScoreChart.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const stageCopy = [
  {
    title: "Text extraction",
    detail: "Reads PDF or DOCX content and converts the CV into plain text for NLP.",
  },
  {
    title: "NLP cleanup",
    detail: "Tokenizes text, removes stopwords and noisy domain fragments, then lemmatizes terms.",
  },
  {
    title: "TF-IDF keywords",
    detail: "Ranks the words and phrases that make this CV distinct compared with the job corpus.",
  },
  {
    title: "ML category score",
    detail: "Uses Logistic Regression probabilities to estimate how clearly the CV maps to a career category.",
  },
  {
    title: "Job matching",
    detail: "Compares the CV vector with job descriptions using cosine similarity.",
  },
];

export default function Result() {
  const { cvId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const statusData = await api.cvStatus(cvId);
      setStatus(statusData);
      if (statusData.status === "done") {
        const resultData = await api.cvResult(cvId);
        setResult(resultData);
      }
    } catch (exc) {
      if (exc instanceof ApiError && exc.status === 202) {
        return;
      }
      setError(exc.message || "Could not load CV analysis.");
    } finally {
      setLoading(false);
    }
  }, [cvId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!status || status.status === "done" || status.status === "failed") {
      return undefined;
    }
    const interval = window.setInterval(load, 2500);
    return () => window.clearInterval(interval);
  }, [load, status]);

  const isWaiting = status?.status === "pending" || status?.status === "processing";

  const deleteCurrentCV = async () => {
    const filename = status?.filename || result?.filename || `CV #${cvId}`;
    const confirmed = window.confirm(`Delete ${filename}? This removes the uploaded file and saved analysis.`);
    if (!confirmed) {
      return;
    }

    setError("");
    setDeleting(true);
    try {
      await api.deleteCV(cvId);
      navigate("/history", { replace: true });
    } catch (exc) {
      setError(exc.message || "Could not delete CV.");
      setDeleting(false);
    }
  };

  const keywordChartData = useMemo(
    () =>
      (result?.keywords || []).slice(0, 10).map((keyword) => ({
        name: keyword.term,
        weight: Math.round((keyword.weight || 0) * 100),
      })),
    [result],
  );

  const matchChartData = useMemo(
    () =>
      (result?.job_matches || []).map((match) => ({
        name: match.title,
        similarity: match.similarity,
        semantic_similarity: match.semantic_similarity,
        lexical_similarity: match.lexical_similarity,
      })),
    [result],
  );

  const score = Math.max(0, Math.min(100, Number(result?.score) || 0));
  const hasQualityScore = result?.cv_quality_score !== null && result?.cv_quality_score !== undefined;
  const qualityScore = hasQualityScore ? Math.max(0, Math.min(100, Number(result?.cv_quality_score) || 0)) : 0;
  const grade = getGrade(score);
  const qualityGrade = getQualityGrade(qualityScore);
  const textStats = result?.text_stats || {};
  const wordCount = Number(textStats.word_count) || countVisibleWords(result?.extracted_text || "");
  const keywordCount = result?.keywords?.length || 0;
  const bestMatch = result?.job_matches?.[0];
  const qualityBreakdownData = useMemo(
    () =>
      (result?.cv_quality_breakdown || []).map((item) => ({
        name: item.name,
        weight: item.score,
      })),
    [result],
  );

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg border border-sky-100 bg-gradient-to-r from-sky-200 via-pink-100 to-white p-6 shadow-soft">
        <div className="absolute right-6 top-6 hidden rounded-full bg-white/50 px-5 py-2 text-sm font-semibold text-sky-900 ring-1 ring-white/70 md:block">
          Demo analysis trace
        </div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950">CV analysis</h1>
              {status && <StatusBadge status={status.status} />}
            </div>
            <p className="text-sm font-medium text-slate-600">{status?.filename || `CV #${cvId}`}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              This page is intentionally verbose for the demo. It shows the score meaning, the processing stages,
              the strongest keyword signals, and how the CV compares with the sample job corpus.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              type="button"
              onClick={deleteCurrentCV}
              disabled={deleting}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 size={18} />
              {deleting ? "Deleting..." : "Delete CV"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <Panel>
          <div className="text-sm text-slate-500">Loading...</div>
        </Panel>
      ) : status?.status === "failed" ? (
        <Panel>
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="mt-0.5 text-red-600" />
            <div>
              <div className="font-semibold text-slate-950">Processing failed</div>
              <div className="mt-1 text-sm text-slate-600">{status.error_message || "The worker could not process this CV."}</div>
              <Link to="/upload" className="mt-4 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900">
                Upload another CV
              </Link>
            </div>
          </div>
        </Panel>
      ) : isWaiting ? (
        <Panel>
          <div className="flex items-start gap-3">
            <Clock size={22} className="mt-0.5 text-sky-700" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">Analysis in progress</div>
              <div className="mt-1 text-sm text-slate-600">
                The worker is running four synchronized processing threads after text extraction unlocks the NLP stages.
              </div>
              <ProcessingTimeline active />
            </div>
          </div>
        </Panel>
      ) : result ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel tone="blue">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                    <Gauge size={18} />
                    Career fit score
                  </div>
                  <p className="mt-1 text-sm text-slate-600">How strongly the CV points toward the predicted career direction.</p>
                </div>
                <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">
                  relaxed fit
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-[280px_1fr] md:items-center">
                <ScoreChart score={result.score} size="large" />
                <div className="rounded-lg bg-white/70 p-4 ring-1 ring-sky-100">
                  <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Grade</div>
                  <div className="mt-1 text-3xl font-semibold text-slate-950">
                    {score} / 100
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{grade}</div>
                </div>
              </div>
            </Panel>

            <Panel tone="pink">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-pink-900">
                    <FileText size={18} />
                    CV writing quality
                  </div>
                  <p className="mt-1 text-sm text-slate-600">How well the CV is structured, evidenced, and written for recruiters.</p>
                </div>
                <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-pink-800 ring-1 ring-pink-100">
                  writing mark
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-[280px_1fr] md:items-center">
                <ScoreChart score={qualityScore} size="large" />
                <div className="rounded-lg bg-white/70 p-4 ring-1 ring-pink-100">
                  <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Writing mark</div>
                  <div className="mt-1 text-3xl font-semibold text-slate-950">
                    {hasQualityScore ? `${qualityScore} / 100` : "Not scored"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {hasQualityScore ? qualityGrade : "Re-upload this CV after the update to generate the writing-quality model output."}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel tone="pink">
            <div className="mb-4 flex items-center gap-2">
              <BrainCircuit size={20} className="text-pink-700" />
              <h2 className="text-base font-semibold text-slate-950">How the models read this CV</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Metric label="Predicted category" value={result.predicted_category} />
              <Metric label="Writing quality" value={result.cv_quality_level || "Not scored"} />
              <Metric label="Extracted words" value={wordCount.toLocaleString()} />
              <Metric label="Extraction route" value={formatExtractionMethod(textStats.extraction_method)} />
              <Metric label="Keyword signals" value={keywordCount} />
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-700">{result.feedback}</p>
            {result.cv_quality_feedback && <p className="mt-3 text-sm leading-6 text-slate-700">{result.cv_quality_feedback}</p>}
            {result.analysis_summary && (
              <div className="mt-4 rounded-lg bg-white/75 p-3 text-sm leading-6 text-slate-700 ring-1 ring-pink-100">
                {result.analysis_summary}
              </div>
            )}
            <ProcessingTimeline />
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Panel tone="blue">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-sky-700" />
                <h2 className="text-base font-semibold text-slate-950">Strengths detected</h2>
              </div>
              <div className="space-y-3">
                {(result.strengths || []).map((strength) => (
                  <div key={strength.title} className="rounded-lg bg-white/75 p-3 ring-1 ring-sky-100">
                    <div className="text-sm font-semibold text-slate-950">{strength.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{strength.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel tone="pink">
              <div className="mb-4 flex items-center gap-2">
                <BriefcaseBusiness size={20} className="text-pink-700" />
                <h2 className="text-base font-semibold text-slate-950">Recommended career path</h2>
              </div>
              <div className="space-y-3">
                {(result.career_path || []).map((step, index) => (
                  <div key={`${step.stage}-${step.title}`} className="grid gap-3 rounded-lg bg-white/75 p-3 ring-1 ring-pink-100 sm:grid-cols-[92px_1fr]">
                    <div className="text-xs font-semibold uppercase tracking-normal text-pink-700">{step.stage || `Step ${index + 1}`}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{step.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel tone="pink">
              <div className="mb-4 flex items-center gap-2">
                <FileText size={20} className="text-pink-700" />
                <h2 className="text-base font-semibold text-slate-950">CV writing quality breakdown</h2>
              </div>
              <KeywordWeightChart data={qualityBreakdownData} />
            </Panel>

            <Panel tone="blue">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-sky-700" />
                <h2 className="text-base font-semibold text-slate-950">Priority improvement plan</h2>
              </div>
              <div className="space-y-3">
                {(result.improvement_plan?.length ? result.improvement_plan : []).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="flex gap-3 rounded-lg bg-white/75 p-3 ring-1 ring-sky-100">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-pink-400 text-xs font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-normal text-sky-700">{item.priority || "Medium"}</div>
                      <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{item.detail}</p>
                    </div>
                  </div>
                ))}
                {!result.improvement_plan?.length &&
                  (result.cv_quality_suggestions || []).map((suggestion, index) => (
                    <div key={suggestion} className="flex gap-3 rounded-lg bg-white/75 p-3 ring-1 ring-sky-100">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-pink-400 text-xs font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{suggestion}</p>
                    </div>
                  ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <Panel tone="pink">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-pink-700" />
                <h2 className="text-base font-semibold text-slate-950">Missing role signals</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(result.missing_keywords || []).map((keyword) => (
                  <span
                    key={keyword.term}
                    title={keyword.reason}
                    className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-pink-100"
                  >
                    {keyword.term} <span className="text-pink-600">{keyword.priority}</span>
                  </span>
                ))}
              </div>
              {!result.missing_keywords?.length && <p className="text-sm leading-6 text-slate-600">No major missing role keywords were detected for the closest job match.</p>}
            </Panel>

            <Panel tone="blue">
              <div className="mb-4 flex items-center gap-2">
                <Wand2 size={20} className="text-sky-700" />
                <h2 className="text-base font-semibold text-slate-950">Bullet rewrite examples</h2>
              </div>
              <div className="space-y-3">
                {(result.rewrite_examples || []).map((example, index) => (
                  <div key={`${example.before}-${index}`} className="grid gap-3 rounded-lg bg-white/75 p-3 ring-1 ring-sky-100 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-normal text-red-500">Weak</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{example.before}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-normal text-sky-700">Stronger</div>
                      <p className="mt-1 text-sm leading-6 text-slate-800">{example.after}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel>
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-sky-700" />
                <h2 className="text-base font-semibold text-slate-950">Keyword weight chart</h2>
              </div>
              <KeywordWeightChart data={keywordChartData} />
            </Panel>

            <Panel>
              <div className="mb-4 flex items-center gap-2">
                <BriefcaseBusiness size={20} className="text-pink-700" />
                <h2 className="text-base font-semibold text-slate-950">Job similarity chart</h2>
              </div>
              <JobSimilarityChart data={matchChartData} />
            </Panel>
          </div>

          <Panel tone="blue">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-sky-700" />
              <h2 className="text-base font-semibold text-slate-950">Extracted keywords</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.keywords?.map((keyword, index) => (
                <span
                  key={keyword.term}
                  className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-sky-100"
                >
                  #{index + 1} {keyword.term} <span className="text-slate-500">{Math.round((keyword.weight || 0) * 100)}</span>
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Keywords are matched as complete words or phrases in the UI, so a term like "com" will not highlight inside
              a longer word such as "recommendation".
            </p>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness size={20} className="text-pink-700" />
              <h2 className="text-base font-semibold text-slate-950">Job matches</h2>
            </div>
            {bestMatch && (
              <div className="mb-4 rounded-lg bg-gradient-to-r from-sky-100 to-pink-100 p-4 ring-1 ring-white">
                <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Best match</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">
                  {bestMatch.title} at {bestMatch.similarity}% similarity
                </div>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {result.job_matches?.map((match) => (
                <div key={`${match.title}-${match.similarity}`} className="rounded-lg border border-sky-100 bg-white/75 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{match.title}</div>
                      <div className="mt-1 text-xs font-medium text-sky-700">{match.category}</div>
                    </div>
                    <div className="shrink-0 rounded-md bg-pink-50 px-2 py-1 text-sm font-semibold text-pink-800 ring-1 ring-pink-100">
                      {match.similarity}%
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <div className="rounded-md bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
                      Semantic: {match.semantic_similarity ?? "n/a"}%
                    </div>
                    <div className="rounded-md bg-pink-50 px-2 py-1 ring-1 ring-pink-100">
                      Lexical: {match.lexical_similarity ?? "n/a"}%
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-5 text-slate-600">{match.description}</p>
                  {match.match_reasons?.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                      {match.match_reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <FileText size={20} className="text-sky-700" />
              <h2 className="text-base font-semibold text-slate-950">CV text with highlighted keywords</h2>
            </div>
            <div className="max-h-[560px] overflow-auto rounded-lg border border-sky-100 bg-white/70 p-4">
              <KeywordHighlighter text={result.extracted_text} keywords={result.keywords} />
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function Panel({ children, tone = "plain" }) {
  const tones = {
    plain: "border-sky-100 bg-white/70",
    blue: "border-sky-100 bg-gradient-to-br from-sky-100 via-white to-sky-50",
    pink: "border-pink-100 bg-gradient-to-br from-pink-100 via-white to-sky-50",
  };

  return <section className={`render-surface rounded-lg border p-5 shadow-soft ${tones[tone]}`}>{children}</section>;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-white/75 p-3 ring-1 ring-white">
      <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-slate-950" title={String(value ?? "")}>
        {value}
      </div>
    </div>
  );
}

function ProcessingTimeline({ active = false }) {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-5">
      {stageCopy.map((stage, index) => (
        <div key={stage.title} className="rounded-lg bg-white/70 p-3 ring-1 ring-sky-100">
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                active && index > 1 ? "bg-slate-200 text-slate-500" : "bg-gradient-to-br from-sky-400 to-pink-400 text-white"
              }`}
            >
              {index + 1}
            </div>
            <div className="text-xs font-semibold text-slate-950">{stage.title}</div>
          </div>
          <div className="text-xs leading-5 text-slate-600">{stage.detail}</div>
        </div>
      ))}
    </div>
  );
}

function getGrade(score) {
  if (score >= 80) {
    return "Excellent fit signal: the model sees a clear category and strong overlap with trained job language.";
  }
  if (score >= 60) {
    return "Good fit signal: the CV is readable and fairly aligned, but stronger role-specific evidence would help.";
  }
  if (score >= 40) {
    return "Mixed fit signal: the model found some useful evidence, but the target category is still ambiguous.";
  }
  return "Low fit signal: the score is out of 100 and means the model is not confident yet. Add clearer role titles, tools, projects, and measurable results.";
}

function getQualityGrade(score) {
  if (score >= 80) {
    return "Strong writing signal: the CV is complete, structured, specific, and backed by evidence.";
  }
  if (score >= 60) {
    return "Solid writing signal: the CV is usable, but it can gain points with clearer impact and sharper structure.";
  }
  if (score >= 40) {
    return "Mixed writing signal: the CV has useful content but needs stronger sections, metrics, and action language.";
  }
  return "Weak writing signal: the CV needs clearer structure, more detail, and measurable achievements.";
}

function countVisibleWords(text) {
  if (!text) {
    return 0;
  }

  try {
    const matches = text.normalize("NFKC").match(/\p{L}[\p{L}\p{N}+#'`.-]*/gu);
    return matches ? matches.length : 0;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

function formatExtractionMethod(method) {
  const labels = {
    "pdf-text": "PDF text",
    "pdf-layout": "PDF layout",
    "pdf-words-position": "PDF word map",
    "pdf-words-flow": "PDF text flow",
    "pdf-empty": "PDF empty",
    "docx-structured": "DOCX structure",
    "docx-xml": "DOCX XML",
  };
  return labels[method] || method || "Unknown";
}
