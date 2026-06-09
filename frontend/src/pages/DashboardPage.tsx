import { KpiCards } from '../components/KpiCards'
import { ExpensesByCategoryChart } from '../components/Charts/ExpensesByCategoryChart'
import { IncomeByCategoryChart } from '../components/Charts/IncomeByCategoryChart'
import { CashFlowChart } from '../components/Charts/CashFlowChart'
import { PeriodFilter } from '../components/PeriodFilter'
import { PeriodProvider } from '../state/period'
import { NetWorthSection } from '../components/NetWorthSection'
import { MarketDataBanner } from '../components/MarketDataBanner'
import { PortfolioValueChart } from '../components/Charts/PortfolioValueChart'

export function DashboardPage() {
  return (
    <PeriodProvider>
      <div className="page dashboard-page">
        <h1 className="page-title">Dashboard</h1>
        <PeriodFilter />
        <MarketDataBanner />
        <NetWorthSection />
        <section className="card">
          <h2>Cash flows (period)</h2>
          <KpiCards />
        </section>
        <PortfolioValueChart />
        <CashFlowChart />
        <div className="charts-row">
          <ExpensesByCategoryChart />
          <IncomeByCategoryChart />
        </div>
      </div>
    </PeriodProvider>
  )
}
