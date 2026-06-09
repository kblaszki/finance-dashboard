import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { AccountDetailPage } from './pages/AccountDetailPage'
import { TransactionsLayout } from './pages/TransactionsLayout'
import { TransactionsListPage } from './pages/TransactionsListPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { ImportPage } from './pages/ImportPage'
import { useAuth } from './state/auth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/transactions" element={<TransactionsLayout />}>
            <Route index element={<TransactionsListPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="import" element={<ImportPage />} />
          </Route>
          <Route path="/portfolios" element={<Navigate to="/accounts" replace />} />
          <Route path="/portfolio" element={<Navigate to="/accounts" replace />} />
          <Route path="/portfolio/trades" element={<Navigate to="/accounts" replace />} />
          <Route path="/portfolio/:symbol" element={<Navigate to="/accounts" replace />} />
          <Route path="/categories" element={<Navigate to="/transactions/categories" replace />} />
          <Route path="/import" element={<Navigate to="/transactions/import" replace />} />
          <Route path="/budgets" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function GuestOnly(props: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-page">
        <p className="loading-state">Loading…</p>
      </div>
    )
  }
  if (user) {
    return <Navigate to="/" replace />
  }
  return props.children
}

export default App
