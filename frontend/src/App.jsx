import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Result = lazy(() => import("./pages/Result.jsx"));
const Upload = lazy(() => import("./pages/Upload.jsx"));

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
          <Route path="history" element={<History />} />
          <Route path="cv/:cvId" element={<Result />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#e0f2fe_0%,#fdf2f8_42%,#f8fbff_100%)]">
      <div className="rounded-lg border border-white/70 bg-white/75 px-5 py-4 text-sm font-semibold text-slate-700 shadow-soft">
        Loading interface...
      </div>
    </div>
  );
}
