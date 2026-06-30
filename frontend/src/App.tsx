import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import { PasswordResetPage } from "./pages/PasswordResetPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { AccountDetailPage } from "./pages/AccountDetailPage";
import { HoldingDetailPage } from "./pages/HoldingDetailPage";
import { AssetDetailPage } from "./pages/AssetDetailPage";
import { TaxReportPage } from "./pages/TaxReportPage";
import { TransactionsListPage } from "./pages/TransactionsListPage";
import { TransfersPage } from "./pages/TransfersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { ImportPage } from "./pages/ImportPage";
import { IncomeEventsPage } from "./pages/IncomeEventsPage";
import { LiabilitiesPage } from "./pages/LiabilitiesPage";
import { TaxSettingsPage } from "./pages/TaxSettingsPage";
import { useAuth } from "./state/auth";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/password-reset" element={<GuestOnly><PasswordResetPage /></GuestOnly>} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/accounts/:id/assets/:instrumentId" element={<HoldingDetailPage />} />
          <Route path="/accounts/:id/holdings/:holdingId" element={<HoldingDetailPage />} />
          <Route path="/transactions" element={<TransactionsListPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/income-events" element={<IncomeEventsPage />} />
          <Route path="/liabilities" element={<LiabilitiesPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/tax" element={<TaxReportPage />} />
          <Route path="/tax/settings" element={<TaxSettingsPage />} />
          <Route path="/tax/:year" element={<TaxReportPage />} />
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

function GuestOnly(props: { children: React.ReactNode }) {
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
  return props.children;
}

export default App;
