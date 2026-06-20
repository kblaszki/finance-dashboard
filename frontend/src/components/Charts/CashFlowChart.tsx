import { useCashFlow } from '../../state/cashflow'
import { useCurrency } from '../../state/currency'
import { formatMoney } from '../../utils/format'

export function CashFlowChart() {
  const { stats, loading, error } = useCashFlow()
  const { currency } = useCurrency()

  if (loading) {
    return (
      <div className="card">
        <h2>Cash flow (period)</h2>
        <p className="empty-state">Loading…</p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="card">
        <h2>Cash flow (period)</h2>
        <p className="error-banner">{error ?? 'Failed to load cash flow'}</p>
      </div>
    )
  }

  const rows = [
    { name: 'Income', value: stats.income, valueClass: 'positive' as const },
    { name: 'Expenses', value: stats.expense, valueClass: 'negative' as const },
    { name: 'Net', value: stats.net, valueClass: stats.net >= 0 ? ('positive' as const) : ('negative' as const) },
  ]

  return (
    <div className="card">
      <h2>Cash flow (period)</h2>
      <ul className="stat-list">
        {rows.map((row) => (
          <li key={row.name} className="stat-row">
            <span className="stat-row-label">{row.name}</span>
            <span className={`stat-row-value ${row.valueClass}`}>
              {formatMoney(row.value, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
