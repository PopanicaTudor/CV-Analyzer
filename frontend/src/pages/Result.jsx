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
    detail: "Compares the CV vector with market profiles and the user's requested target jobs.",
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
  const targetChartData = useMemo(
    () =>
      (result?.target_job_matches || []).map((match) => ({
        name: match.title,
        similarity: match.similarity,
        semantic_similarity: match.semantic_similarity,
        lexical_similarity: match.lexical_similarity,
      })),
    [result],
  );
  const careerBreakdownData = result?.career_score_breakdown || [];

  const score = Math.max(0, Math.min(100, Number(result?.score) || 0));
  const hasQualityScore = result?.cv_quality_score !== null && result?.cv_quality_score !== undefined;
  const qualityScore = hasQualityScore ? Math.max(0, Math.min(100, Number(result?.cv_quality_score) || 0)) : 0;
  const grade = getGrade(score);
  const qualityGrade = getQualityGrade(qualityScore);
  const textStats = result?.text_stats || {};
  const wordCount = Number(textStats.word_count) || countVisibleWords(result?.extracted_text || "");
  const keywordCount = result?.keywords?.length || 0;
  const bestMarketMatch = result?.job_matches?.[0];
  const bestTargetMatch = result?.target_job_matches?.[0];
  const bestMatch = bestTargetMatch || bestMarketMatch;
  const profile = result?.personalization_profile || {};
  const recommendations = result?.personalized_recommendations || [];
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
        <div className="absolute right-6 top-6 hidden rounded-full bg-white/60 px-5 py-2 text-sm font-semibold text-sky-900 ring-1 ring-white/70 md:block">
          Product analysis + demo trace
        </div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950">CV analysis</h1>
              {status && <StatusBadge status={status.status} />}
            </div>
            <p className="text-sm font-medium text-slate-600">{status?.filename || `CV #${cvId}`}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              The main panels focus on personalized career advice. Amber panels are demo-only explainability views that
              expose internal model signals for this project presentation.
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
                  {careerBreakdownData.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {careerBreakdownData.slice(0, 4).map((item) => (
                        <div key={item.name}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                            <span className="truncate">{item.name}</span>
                            <span>{Math.round(Number(item.score) || 0)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-sky-50 ring-1 ring-sky-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                              style={{ width: `${Math.max(0, Math.min(100, Number(item.score) || 0))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

          {result.target_job_matches?.length > 0 && (
            <Panel tone="blue">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness size={20} className="text-sky-700" />
                  <h2 className="text-base font-semibold text-slate-950">Target job alignment</h2>
                </div>
                <ProductBadge />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {result.target_job_matches.map((match) => (
                  <div key={`${match.title}-${match.similarity}`} className="rounded-lg bg-white/80 p-4 ring-1 ring-sky-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-950">{match.title}</div>
                        <div className="mt-1 text-xs font-medium text-sky-700">
                          {match.category}
                          {match.reference_title ? ` via ${match.reference_title}` : ""}
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-md px-2 py-1 text-sm font-semibold ring-1 ${alignmentClass(match.similarity)}`}>
                        {Math.round(Number(match.similarity) || 0)}%
                      </div>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-sky-50 ring-1 ring-sky-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-pink-400"
                        style={{ width: `${Math.max(0, Math.min(100, Number(match.similarity) || 0))}%` }}
                      />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-800">{match.alignment_verdict || "Alignment signal"}</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <SignalList title="Found signals" values={match.covered_terms || []} empty="No strong overlap yet" />
                      <SignalList title="Missing signals" values={match.missing_terms || []} empty="No major missing terms" />
                    </div>
                    {match.match_reasons?.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                        {match.match_reasons.slice(0, 3).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="space-y-6">
            <Panel tone="blue">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={20} className="text-sky-700" />
                  <h2 className="text-base font-semibold text-slate-950">Personalized next actions</h2>
                </div>
                <ProductBadge />
              </div>
              <div className="space-y-3">
                {(recommendations.length ? recommendations : fallbackRecommendations(result)).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg bg-white/80 p-4 ring-1 ring-sky-100">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(item.priority)}`}>
                        {item.priority || "Medium"}
                      </span>
                      <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{item.why}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.how}</p>
                    {item.example && (
                      <div className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm leading-6 text-slate-700 ring-1 ring-sky-100">
                        {item.example}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel tone="pink">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-pink-700" />
                  <h2 className="text-base font-semibold text-slate-950">Personalization chart</h2>
                </div>
                <ProductBadge />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SnapshotGroup label="Target role" values={[profile.target_role || bestMatch?.title || result.predicted_category]} />
                <SnapshotGroup label="Detected skills" values={profile.detected_skills || []} empty="No explicit skills detected yet" />
                <SnapshotGroup label="Visible proof" values={profile.metrics || []} empty="No measurable proof detected yet" />
                <SnapshotGroup label="Missing target signals" values={profile.missing_target_terms || []} empty="No major target gaps detected" />
                <SnapshotGroup label="Sections to consider" values={profile.missing_sections || []} empty="Core sections look present" />
              </div>
            </Panel>
          </div>

          <Panel tone="demo">
            <div className="mb-4 flex items-center gap-2">
              <BrainCircuit size={20} className="text-amber-700" />
              <h2 className="text-base font-semibold text-slate-950">How the models read this CV</h2>
              <DemoBadge />
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
            {careerBreakdownData.length > 0 && (
              <Panel tone="blue">
                <div className="mb-4 flex items-center gap-2">
                  <Gauge size={20} className="text-sky-700" />
                  <h2 className="text-base font-semibold text-slate-950">Career fit breakdown</h2>
                </div>
                <div className="space-y-3">
                  {careerBreakdownData.map((item) => (
                    <div key={item.name} className="rounded-lg bg-white/75 p-3 ring-1 ring-sky-100">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                        <div className="text-sm font-semibold text-sky-800">{Math.round(Number(item.score) || 0)}/100</div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-sky-50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                          style={{ width: `${Math.max(0, Math.min(100, Number(item.score) || 0))}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{item.evidence}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

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
            {targetChartData.length > 0 && (
              <Panel tone="demo">
                <div className="mb-4 flex items-center gap-2">
                  <BriefcaseBusiness size={20} className="text-amber-700" />
                  <h2 className="text-base font-semibold text-slate-950">Requested job similarity chart</h2>
                  <DemoBadge />
                </div>
                <JobSimilarityChart data={targetChartData} />
              </Panel>
            )}

            <Panel tone="demo">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-amber-700" />
                <h2 className="text-base font-semibold text-slate-950">Keyword weight chart</h2>
                <DemoBadge />
              </div>
              <KeywordWeightChart data={keywordChartData} />
            </Panel>

            <Panel tone="demo">
              <div className="mb-4 flex items-center gap-2">
                <BriefcaseBusiness size={20} className="text-amber-700" />
                <h2 className="text-base font-semibold text-slate-950">Job similarity chart</h2>
                <DemoBadge />
              </div>
              <JobSimilarityChart data={matchChartData} />
            </Panel>
          </div>

          <Panel tone="demo">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-amber-700" />
              <h2 className="text-base font-semibold text-slate-950">Extracted keywords</h2>
              <DemoBadge />
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
              <ProductBadge />
            </div>
            {bestMarketMatch && (
              <div className="mb-4 rounded-lg bg-gradient-to-r from-sky-100 to-pink-100 p-4 ring-1 ring-white">
                <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">Best match</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">
                  {bestMarketMatch.title} at {bestMarketMatch.similarity}% similarity
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

          <Panel tone="demo">
            <div className="mb-4 flex items-center gap-2">
              <FileText size={20} className="text-amber-700" />
              <h2 className="text-base font-semibold text-slate-950">CV text with highlighted keywords</h2>
              <DemoBadge />
            </div>
            <div className="max-h-[560px] overflow-auto rounded-lg border border-amber-100 bg-white/70 p-4">
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
    demo: "border-amber-200 bg-gradient-to-br from-amber-100 via-white to-orange-50",
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

function ProductBadge() {
  return <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">Product</span>;
}

function DemoBadge() {
  return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">Demo trace</span>;
}

function SnapshotGroup({ label, values = [], empty }) {
  const visibleValues = Array.isArray(values) ? values.filter(Boolean).slice(0, 10) : [];
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      {visibleValues.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleValues.map((value) => (
            <span key={value} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-pink-100">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-600">{empty}</p>
      )}
    </div>
  );
}

function SignalList({ title, values = [], empty }) {
  const visibleValues = Array.isArray(values) ? values.filter(Boolean).slice(0, 8) : [];
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500">{title}</div>
      {visibleValues.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleValues.map((value) => (
            <span key={value} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-sky-100">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function alignmentClass(score) {
  const value = Number(score) || 0;
  if (value >= 80) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  }
  if (value >= 65) {
    return "bg-sky-50 text-sky-800 ring-sky-100";
  }
  if (value >= 50) {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }
  return "bg-red-50 text-red-700 ring-red-100";
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

function priorityClass(priority = "Medium") {
  const normalized = priority.toLowerCase();
  if (normalized === "high") {
    return "bg-pink-100 text-pink-800 ring-1 ring-pink-200";
  }
  if (normalized === "low") {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
  return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
}

function fallbackRecommendations(result) {
  return [
    {
      priority: "High",
      title: `Clarify the target direction: ${result?.predicted_category || "target role"}`,
      why: "This result was generated before the personalization update, so only generic model fields are available.",
      how: "Re-upload the CV to generate skill-aware, role-aware recommendations.",
      example: "Add a short summary that names the target role, strongest tools, and one measurable achievement.",
    },
  ];
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
