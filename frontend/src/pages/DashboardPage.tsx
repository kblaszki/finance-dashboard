import { KpiCards } from '../components/KpiCards'
import { ExpensesByCategoryChart } from '../components/Charts/ExpensesByCategoryChart'
import { IncomeByCategoryChart } from '../components/Charts/IncomeByCategoryChart'
import { CashFlowChart } from '../components/Charts/CashFlowChart'
import { PeriodFilter } from '../components/PeriodFilter'
import { MarketPricesStatus } from '../components/MarketPricesStatus'
import { PeriodProvider } from '../state/period'
import { CashFlowProvider } from '../state/cashflow'
import { NetWorthSection } from '../components/NetWorthSection'

export function DashboardPage() {
  return (
    <PeriodProvider>
      <CashFlowProvider>
        <div className="page dashboard-page">
          <h1 className="page-title">Dashboard</h1>
          <MarketPricesStatus />
          <PeriodFilter />
          <NetWorthSection />
          <section className="card">
            <h2>Cash flows (period)</h2>
            <KpiCards />
          </section>
          <CashFlowChart />
          <div className="charts-row">
            <ExpensesByCategoryChart />
            <IncomeByCategoryChart />
          </div>
        </div>
      </CashFlowProvider>
    </PeriodProvider>
  )
}
