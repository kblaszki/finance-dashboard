import { useCallback } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchPortfolioSummary } from '../api/statsApi'
import { useCurrency } from '../state/currency'
import { usePeriod } from '../state/period'
import { formatMoney } from '../utils/format'

function formatReturnPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function PortfolioKpiCards() {
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const loader = useCallback(
    () =>
      fetchPortfolioSummary({
        from: range.from,
        to: range.to,
        currency,
      }),
    [currency, range.from, range.to],
  )
  const { data, error, loading } = useAsyncData(loader)

  if (loading) return <p className="loading-state">Loading portfolio KPIs…</p>
  if (error || !data) {
    return <p className="error-banner">{error ?? 'Failed to load portfolio summary'}</p>
  }

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Portfolio value</h3>
        <p>{formatMoney(data.totalValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Securities</h3>
        <p>{formatMoney(data.securitiesValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Cash</h3>
        <p>{formatMoney(data.cashValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Unrealized P/L</h3>
        <p>{data.unrealizedPnl != null ? formatMoney(data.unrealizedPnl, currency) : '—'}</p>
      </div>
      <div className="kpi-card">
        <h3>Return (period)</h3>
        <p className={data.returnPct != null && data.returnPct >= 0 ? 'positive' : 'negative'}>
          {formatReturnPct(data.returnPct)}
        </p>
      </div>
    </div>
  )
}
