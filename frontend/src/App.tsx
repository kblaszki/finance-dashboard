import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import { TransactionTable } from './components/TransactionTable'
import { PortfolioTable } from './components/PortfolioTable'
import { KpiCards } from './components/KpiCards'
import { ExpensesByCategoryChart } from './components/Charts/ExpensesByCategoryChart'
import { CurrencySelect } from './components/CurrencySelect'

function App() {
  return (
    <div className="app-root">
      <aside className="app-sidebar">
        <h1 className="app-logo">Finance Dashboard</h1>
        <CurrencySelect />
        <nav className="app-nav">
          <Link to="/">Dashboard</Link>
          <Link to="/transactions">Transakcje</Link>
          <Link to="/portfolio">Portfel</Link>
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
    <div className="dashboard-page">
      <KpiCards />
      <ExpensesByCategoryChart />
    </div>
  )
}

function TransactionsPage() {
  return <TransactionTable />
}

function PortfolioPage() {
  return <PortfolioTable />
}

export default App
