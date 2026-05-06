import { BrainCircuit, Eye, EyeOff, FileCheck2, LogIn, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (exc) {
      setError(exc.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to open your analysis dashboard.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Username or email</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
            autoComplete="username"
            className="focus-ring mt-1 w-full rounded-md border border-sky-100 bg-white/85 px-3 py-2.5 text-sm shadow-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <div className="mt-1 flex rounded-md border border-sky-100 bg-white/85 shadow-sm">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="focus-ring min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="focus-ring rounded-r-md px-3 text-slate-500 hover:bg-pink-50"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:from-sky-600 hover:to-pink-600 disabled:opacity-60"
        >
          <LogIn size={18} />
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-600">
        Need an account?{" "}
        <Link to="/register" className="font-semibold text-pink-700 hover:text-pink-800">
          Create one
        </Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#dff3ff_0%,#fff1f8_42%,#f8fbff_100%)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden overflow-hidden rounded-lg border border-white/70 bg-white/60 p-8 shadow-soft lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-sky-900 ring-1 ring-sky-100">
            <Sparkles size={16} />
            AI-powered career assistant
          </div>
          <h1 className="max-w-xl text-5xl font-semibold tracking-normal text-slate-950">CV Analyzer Pro</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">
            Upload a CV, let the worker extract signals, then show the scoring story with model confidence, TF-IDF
            keywords, and job similarity analysis.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <AuthFeature icon={FileCheck2} title="Async CV queue" detail="RabbitMQ pipeline" />
            <AuthFeature icon={BrainCircuit} title="Real ML model" detail="TF-IDF + Logistic Regression" />
            <AuthFeature icon={Sparkles} title="Visual report" detail="Charts and verbose trace" />
          </div>
          <div className="mt-8 h-3 overflow-hidden rounded-full bg-white/70">
            <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-400" />
          </div>
        </section>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <div className="text-2xl font-semibold tracking-normal text-slate-950">CV Analyzer Pro</div>
            <div className="mt-1 text-sm text-slate-500">AI-powered career assistant</div>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-soft">
            <div className="mb-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">
                <Sparkles size={14} />
                Secure workspace
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthFeature({ icon: Icon, title, detail }) {
  return (
    <div className="rounded-lg bg-white/70 p-4 ring-1 ring-white">
      <Icon size={22} className="text-pink-600" />
      <div className="mt-3 text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-600">{detail}</div>
    </div>
  );
}
