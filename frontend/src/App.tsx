import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { TransactionTable } from './components/TransactionTable'
import { PortfolioTable } from './components/PortfolioTable'
import { KpiCards } from './components/KpiCards'
import { ExpensesByCategoryChart } from './components/Charts/ExpensesByCategoryChart'
import { CurrencySelect } from './components/CurrencySelect'
import { ThemeToggle } from './components/ThemeToggle'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BudgetProgress } from './components/BudgetProgress'
import { BudgetTable } from './components/BudgetTable'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { useAuth } from './state/auth'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'active' : undefined
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
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
        <p className="loading-state">Ładowanie…</p>
      </div>
    )
  }
  if (user) {
    return <Navigate to="/" replace />
  }
  return props.children
}

function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="app-root">
      <aside className="app-sidebar">
        <h1 className="app-logo">Finance Dashboard</h1>
        <div className="sidebar-user">
          <span className="sidebar-user-email" title={user?.email ?? ''}>
            {user?.email}
          </span>
          <button type="button" className="theme-toggle" onClick={logout}>
            Wyloguj
          </button>
        </div>
        <div className="sidebar-controls">
          <CurrencySelect />
          <ThemeToggle />
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={navLinkClass}>
            Transakcje
          </NavLink>
          <NavLink to="/portfolio" className={navLinkClass}>
            Portfel
          </NavLink>
          <NavLink to="/budgets" className={navLinkClass}>
            Budżety
          </NavLink>
        </nav>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

function DashboardPage() {
  return (
    <div className="page dashboard-page">
      <h1 className="page-title">Dashboard</h1>
      <KpiCards />
      <section className="card">
        <h2>Budżety (bieżący miesiąc)</h2>
        <BudgetProgress />
      </section>
      <ExpensesByCategoryChart />
    </div>
  )
}

function TransactionsPage() {
  return (
    <div className="page">
      <h1 className="page-title">Transakcje</h1>
      <TransactionTable />
    </div>
  )
}

function PortfolioPage() {
  return (
    <div className="page">
      <h1 className="page-title">Portfel</h1>
      <PortfolioTable />
    </div>
  )
}

function BudgetsPage() {
  return (
    <div className="page">
      <h1 className="page-title">Budżety</h1>
      <BudgetTable />
    </div>
  )
}

export default App
