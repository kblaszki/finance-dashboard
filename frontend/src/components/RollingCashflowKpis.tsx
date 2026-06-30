import { useCallback } from 'react'
import { fetchCashflowRolling12m } from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

export function RollingCashflowKpis() {
  const { currency } = useCurrency()
  const loader = useCallback(() => fetchCashflowRolling12m(currency), [currency])
  const { data, error, loading } = useAsyncData(loader)

  if (loading) return <p className="loading-state">Loading 12-month averages…</p>
  if (error || !data) {
    return <p className="error-banner">{error ?? 'Failed to load rolling averages'}</p>
  }

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Avg monthly income (12m)</h3>
        <p>{formatMoney(data.avgIncome, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Avg monthly expenses (12m)</h3>
        <p>{formatMoney(data.avgExpense, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Avg monthly net (12m)</h3>
        <p className={data.avgNet >= 0 ? 'positive' : 'negative'}>
          {formatMoney(data.avgNet, currency)}
        </p>
      </div>
    </div>
  )
}
