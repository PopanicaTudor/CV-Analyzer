import { BarChart3, FileClock, LogOut, Sparkles, UploadCloud } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/upload", label: "Upload", icon: UploadCloud },
  { to: "/history", label: "History", icon: FileClock },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#e0f2fe_0%,#fdf2f8_42%,#f8fbff_100%)] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sky-100 bg-gradient-to-b from-sky-100 via-white to-pink-100 px-4 py-5 shadow-soft lg:block">
        <div className="mb-8">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-pink-400 text-white shadow-soft">
            <Sparkles size={22} />
          </div>
          <div className="text-lg font-semibold text-slate-950">CV Analyzer Pro</div>
          <div className="mt-1 text-sm text-slate-500">AI career assistant</div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-gradient-to-r from-sky-100 to-pink-100 text-slate-950 shadow-sm ring-1 ring-white"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-950",
                ].join(" ")
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-5 left-4 right-4">
          <div className="mb-3 rounded-lg border border-white bg-white/75 p-3 shadow-sm">
            <div className="truncate text-sm font-semibold text-slate-950">{user?.username}</div>
            <div className="truncate text-xs text-slate-500">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white/70"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 px-4 py-3 shadow-sm lg:hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-950">CV Analyzer Pro</div>
              <div className="text-xs text-slate-500">{user?.username}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              className="focus-ring rounded-md p-2 text-slate-600 hover:bg-pink-50"
            >
              <LogOut size={20} />
            </button>
          </div>
          <nav className="mt-3 grid grid-cols-3 gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center justify-center rounded-md px-2 py-2 text-xs font-medium",
                    isActive ? "bg-gradient-to-r from-sky-100 to-pink-100 text-slate-950" : "bg-white/70 text-slate-600",
                  ].join(" ")
                }
              >
                <item.icon size={16} className="mr-1" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
