import { useCashFlow } from '../state/cashflow'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

export function KpiCards() {
  const { stats, loading, error } = useCashFlow()
  const { currency } = useCurrency()

  if (loading) {
    return <p className="loading-state">Loading KPIs…</p>
  }

  if (error || !stats) {
    return <p className="error-banner">{error ?? 'Failed to load KPIs'}</p>
  }

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Income (period)</h3>
        <p>{formatMoney(stats.income, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Expenses (period)</h3>
        <p>{formatMoney(stats.expense, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Net flow (period)</h3>
        <p>{formatMoney(stats.net, currency)}</p>
      </div>
    </div>
  )
}
