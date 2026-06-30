import { useCallback } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchAverageHoldingReturn, fetchPortfolioSummary } from '../api/statsApi'
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
      Promise.all([
        fetchPortfolioSummary({
          from: range.from,
          to: range.to,
          currency,
        }),
        fetchAverageHoldingReturn(currency),
      ]).then(([summary, averageReturn]) => ({ summary, averageReturn })),
    [currency, range.from, range.to],
  )
  const { data, error, loading } = useAsyncData(loader)

  if (loading) return <p className="loading-state">Loading portfolio KPIs…</p>
  if (error || !data) {
    return <p className="error-banner">{error ?? 'Failed to load portfolio summary'}</p>
  }

  const { summary, averageReturn } = data

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Portfolio value</h3>
        <p>{formatMoney(summary.totalValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Securities</h3>
        <p>{formatMoney(summary.securitiesValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Cash</h3>
        <p>{formatMoney(summary.cashValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Unrealized P/L</h3>
        <p>{summary.unrealizedPnl != null ? formatMoney(summary.unrealizedPnl, currency) : '—'}</p>
      </div>
      <div className="kpi-card">
        <h3>Average return</h3>
        <p
          className={
            averageReturn.averageReturnPct != null && averageReturn.averageReturnPct >= 0
              ? 'positive'
              : 'negative'
          }
        >
          {formatReturnPct(averageReturn.averageReturnPct)}
        </p>
      </div>
    </div>
  )
}
