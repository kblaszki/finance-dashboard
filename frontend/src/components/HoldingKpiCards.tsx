import type { HoldingSummary } from '../api/holdingsApi'
import { formatMoney } from '../utils/format'

type Props = {
  holding: HoldingSummary
  currency: string
}

function formatGainPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function HoldingKpiCards({ holding, currency }: Props) {
  const isOpen = holding.quantity > 0
  const gainPct =
    isOpen && holding.unrealizedPnl != null && holding.costBasis != null && holding.costBasis > 0
      ? (holding.unrealizedPnl / holding.costBasis) * 100
      : null

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Quantity</h3>
        <p>{holding.quantity}</p>
      </div>
      {isOpen ? (
        <>
          <div className="kpi-card">
            <h3>Current value</h3>
            <p>
              {holding.marketValue != null ? formatMoney(holding.marketValue, currency) : '—'}
            </p>
          </div>
          <div className="kpi-card">
            <h3>Cost basis</h3>
            <p>
              {holding.costBasis != null ? formatMoney(holding.costBasis, currency) : '—'}
            </p>
          </div>
          <div className="kpi-card">
            <h3>Unrealized gain</h3>
            <p className={holding.unrealizedPnl != null && holding.unrealizedPnl >= 0 ? 'positive' : 'negative'}>
              {holding.unrealizedPnl != null ? formatMoney(holding.unrealizedPnl, currency) : '—'}
              {gainPct != null && (
                <span className="muted"> ({formatGainPct(gainPct)})</span>
              )}
            </p>
          </div>
        </>
      ) : (
        <div className="kpi-card">
          <h3>Realized gain</h3>
          <p className={holding.realizedPnl != null && holding.realizedPnl >= 0 ? 'positive' : 'negative'}>
            {holding.realizedPnl != null ? formatMoney(holding.realizedPnl, currency) : '—'}
          </p>
        </div>
      )}
    </div>
  )
}
