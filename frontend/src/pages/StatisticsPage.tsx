import { CashflowHistoryChart } from '../components/Charts/CashflowHistoryChart'
import { CategoryBreakdownSection } from '../components/CategoryBreakdownSection'
import { KpiCards } from '../components/KpiCards'
import { PeriodFilter } from '../components/PeriodFilter'
import { CashFlowProvider } from '../state/cashflow'
import { PeriodProvider } from '../state/period'

export function StatisticsPage() {
  return (
    <PeriodProvider initialPreset="current_month">
      <CashFlowProvider>
        <div className="page">
          <h1 className="page-title">Statistics</h1>
          <p className="muted page-lead">
            Income, expenses, and net income for the selected period. Internal transfers are
            excluded.
          </p>
          <PeriodFilter />
          <section className="card">
            <h2>Summary</h2>
            <KpiCards />
          </section>
          <CashflowHistoryChart />
          <CategoryBreakdownSection />
        </div>
      </CashFlowProvider>
    </PeriodProvider>
  )
}
