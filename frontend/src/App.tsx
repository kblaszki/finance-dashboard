import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { AuthSwapShell } from "./components/AuthSwapShell";
import { OrganizeLayout } from "./components/OrganizeLayout";
import { WealthLayout } from "./components/WealthLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { TagsPage } from "./pages/TagsPage";
import { TransfersPage } from "./pages/TransfersPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { MarketsPage } from "./pages/MarketsPage";
import { InstrumentDetailPage } from "./pages/InstrumentDetailPage";
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
          <Route path="/cashflow" element={<StatisticsPage />} />
          <Route
            path="/statistics"
            element={<Navigate to="/cashflow" replace />}
          />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/wealth" element={<Navigate to="/accounts" replace />} />
          <Route element={<WealthLayout />}>
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route
              path="/markets/:instrumentId"
              element={<InstrumentDetailPage />}
            />
          </Route>
          <Route
            path="/organize"
            element={<Navigate to="/organize/categories" replace />}
          />
          <Route element={<OrganizeLayout />}>
            <Route
              path="/organize/categories"
              element={<CategoriesPage />}
            />
            <Route path="/organize/tags" element={<TagsPage />} />
          </Route>
          <Route
            path="/categories"
            element={<Navigate to="/organize/categories" replace />}
          />
          <Route
            path="/tags"
            element={<Navigate to="/organize/tags" replace />}
          />
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
