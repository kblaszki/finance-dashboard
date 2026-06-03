import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'
import { TransactionTable } from './components/TransactionTable'
import { PortfolioTable } from './components/PortfolioTable'
import { KpiCards } from './components/KpiCards'
import { ExpensesByCategoryChart } from './components/Charts/ExpensesByCategoryChart'
import { IncomeByCategoryChart } from './components/Charts/IncomeByCategoryChart'
import { CashFlowChart } from './components/Charts/CashFlowChart'
import { PeriodFilter } from './components/PeriodFilter'
import { PeriodProvider } from './state/period'
import { CurrencySelect } from './components/CurrencySelect'
import { ThemeToggle } from './components/ThemeToggle'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BudgetProgress } from './components/BudgetProgress'
import { BudgetTable } from './components/BudgetTable'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { useAuth } from './state/auth'
import { PortfolioPositionAnalysis } from './components/PortfolioPositionAnalysis'
import { NetWorthSection } from './components/NetWorthSection'
import { PortfolioValueChart } from './components/Charts/PortfolioValueChart'
import { AllPortfoliosTable } from './components/AllPortfoliosTable'
import { PortfolioTradesTable } from './components/PortfolioTradesTable'
import { AccountsTable } from './components/AccountsTable'
import { CategoriesTable } from './components/CategoriesTable'
import { CsvImportForm } from './components/CsvImportForm'

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
          <Route path="/portfolios" element={<AllPortfoliosPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/portfolio/trades" element={<PortfolioTradesPage />} />
          <Route path="/portfolio/:symbol" element={<PortfolioAnalysisPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/import" element={<ImportPage />} />
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
          <NavLink to="/portfolios" className={navLinkClass}>
            Portfele
          </NavLink>
          <NavLink to="/portfolio" className={navLinkClass}>
            Portfel
          </NavLink>
          <NavLink to="/accounts" className={navLinkClass}>
            Konta
          </NavLink>
          <NavLink to="/categories" className={navLinkClass}>
            Kategorie
          </NavLink>
          <NavLink to="/import" className={navLinkClass}>
            Import CSV
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
    <PeriodProvider>
      <div className="page dashboard-page">
        <h1 className="page-title">Dashboard</h1>
        <PeriodFilter />
        <NetWorthSection />
        <section className="card">
          <h2>Przepływy pieniężne (okres)</h2>
          <KpiCards />
        </section>
        <PortfolioValueChart />
        <CashFlowChart />
        <div className="charts-row">
          <ExpensesByCategoryChart />
          <IncomeByCategoryChart />
        </div>
        <section className="card">
          <h2>Budżety</h2>
          <BudgetProgress />
        </section>
      </div>
    </PeriodProvider>
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

function AllPortfoliosPage() {
  return (
    <div className="page">
      <h1 className="page-title">Portfele maklerskie</h1>
      <AllPortfoliosTable />
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

function PortfolioTradesPage() {
  return (
    <div className="page">
      <h1 className="page-title">Transakcje portfela</h1>
      <PortfolioTradesTable />
    </div>
  )
}

function AccountsPage() {
  return (
    <div className="page">
      <h1 className="page-title">Konta finansowe</h1>
      <AccountsTable />
    </div>
  )
}

function CategoriesPage() {
  return (
    <div className="page">
      <h1 className="page-title">Kategorie</h1>
      <CategoriesTable />
    </div>
  )
}

function ImportPage() {
  return (
    <div className="page">
      <h1 className="page-title">Import CSV</h1>
      <CsvImportForm />
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

function PortfolioAnalysisPage() {
  return (
    <div className="page">
      <PortfolioPositionAnalysis />
    </div>
  )
}

export default App
