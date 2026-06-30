import { CashflowHistoryChart } from '../components/Charts/CashflowHistoryChart'
import { KpiCards } from '../components/KpiCards'
import { PeriodFilter } from '../components/PeriodFilter'
import { CashFlowProvider } from '../state/cashflow'
import { PeriodProvider } from '../state/period'

export function StatisticsPage() {
  return (
    <PeriodProvider initialPreset="last_12_months">
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
        </div>
      </CashFlowProvider>
    </PeriodProvider>
  )
}
