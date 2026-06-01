import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { TransactionTable } from './components/TransactionTable'
import { PortfolioTable } from './components/PortfolioTable'
import { KpiCards } from './components/KpiCards'
import { ExpensesByCategoryChart } from './components/Charts/ExpensesByCategoryChart'
import { CurrencySelect } from './components/CurrencySelect'
import { ThemeToggle } from './components/ThemeToggle'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'active' : undefined
}

function App() {
  return (
    <div className="app-root">
      <aside className="app-sidebar">
        <h1 className="app-logo">Finance Dashboard</h1>
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
        </nav>
      </aside>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
        </Routes>
      </main>
    </div>
  )
}

function DashboardPage() {
  return (
    <div className="page dashboard-page">
      <h1 className="page-title">Dashboard</h1>
      <KpiCards />
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

export default App
