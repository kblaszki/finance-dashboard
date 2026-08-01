import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import "./App.css";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { AuthSwapShell } from "./components/AuthSwapShell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { useAuth } from "./state/auth";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route element={<GuestOnly />}>
        <Route element={<AuthSwapShell />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-page">
        <p className="loading-state">Loading…</p>
      </div>
    );
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-page">
        <p className="loading-state">Loading…</p>
      </div>
    );
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export default App;
