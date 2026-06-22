import { useState } from 'react'
import { KpiCards } from '../components/KpiCards'
import { ExpensesByCategoryChart } from '../components/Charts/ExpensesByCategoryChart'
import { IncomeByCategoryChart } from '../components/Charts/IncomeByCategoryChart'
import { CashFlowChart } from '../components/Charts/CashFlowChart'
import { AllocationChart } from '../components/Charts/AllocationChart'
import { PortfolioHistoryChart } from '../components/Charts/PortfolioHistoryChart'
import { PeriodFilter } from '../components/PeriodFilter'
import { MarketPricesStatus } from '../components/MarketPricesStatus'
import { PortfolioKpiCards } from '../components/PortfolioKpiCards'
import { BenchmarkComparison } from '../components/BenchmarkComparison'
import { PeriodProvider } from '../state/period'
import { CashFlowProvider } from '../state/cashflow'
import { NetWorthSection } from '../components/NetWorthSection'

type DashboardTab = 'portfolio' | 'budget'

export function DashboardPage() {
  const [tab, setTab] = useState<DashboardTab>('portfolio')

  return (
    <PeriodProvider>
      <CashFlowProvider>
        <div className="page dashboard-page">
          <h1 className="page-title">Dashboard</h1>
          <MarketPricesStatus />
          <div className="inline-form dashboard-tabs">
            <button
              type="button"
              className={tab === 'portfolio' ? 'btn-primary' : 'btn-link'}
              onClick={() => setTab('portfolio')}
            >
              Portfolio
            </button>
            <button
              type="button"
              className={tab === 'budget' ? 'btn-primary' : 'btn-link'}
              onClick={() => setTab('budget')}
            >
              Budget
            </button>
          </div>
          <PeriodFilter />
          <NetWorthSection />

          {tab === 'portfolio' ? (
            <>
              <section className="card">
                <h2>Portfolio (period)</h2>
                <PortfolioKpiCards />
              </section>
              <PortfolioHistoryChart />
              <div className="charts-row">
                <AllocationChart />
                <BenchmarkComparison />
              </div>
            </>
          ) : (
            <>
              <section className="card">
                <h2>Cash flows (period)</h2>
                <KpiCards />
              </section>
              <CashFlowChart />
              <div className="charts-row">
                <ExpensesByCategoryChart />
                <IncomeByCategoryChart />
              </div>
            </>
          )}
        </div>
      </CashFlowProvider>
    </PeriodProvider>
  )
}
