import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { AuthShell } from "./Login.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    password_confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (exc) {
      const data = exc.data;
      const firstFieldError =
        data && typeof data === "object"
          ? Object.values(data)
              .flat()
              .find(Boolean)
          : null;
      setError(firstFieldError || exc.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Start a personal CV intelligence workspace.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={form.first_name} onChange={update("first_name")} autoComplete="given-name" />
          <Input label="Last name" value={form.last_name} onChange={update("last_name")} autoComplete="family-name" />
        </div>
        <Input label="Username" value={form.username} onChange={update("username")} required autoComplete="username" />
        <Input label="Email" type="email" value={form.email} onChange={update("email")} required autoComplete="email" />
        <Input label="Password" type="password" value={form.password} onChange={update("password")} required autoComplete="new-password" />
        <Input
          label="Confirm password"
          type="password"
          value={form.password_confirm}
          onChange={update("password_confirm")}
          required
          autoComplete="new-password"
        />

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-soft hover:from-sky-600 hover:to-pink-600 disabled:opacity-60"
        >
          <UserPlus size={18} />
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link to="/login" className="font-semibold text-pink-700 hover:text-pink-800">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input className="focus-ring mt-1 w-full rounded-md border border-sky-100 bg-white/85 px-3 py-2.5 text-sm shadow-sm" {...props} />
    </label>
  );
}
