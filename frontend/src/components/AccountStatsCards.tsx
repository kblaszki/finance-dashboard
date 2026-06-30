import { useCallback } from 'react'
import { fetchAccountStats } from '../api/accountsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  accountType: string
}

function formatChangePct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function AccountStatsCards({ accountId, accountType }: Props) {
  const { currency } = useCurrency()
  const loader = useCallback(
    () => fetchAccountStats(accountId, currency),
    [accountId, currency],
  )
  const { data, error, loading } = useAsyncData(loader)

  if (loading) return <p className="loading-state">Loading account statistics…</p>
  if (error || !data) {
    return <p className="error-banner">{error ?? 'Failed to load account statistics'}</p>
  }

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>YTD income</h3>
        <p>{formatMoney(data.ytdIncome, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>YTD expenses</h3>
        <p>{formatMoney(data.ytdExpense, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>YTD net</h3>
        <p className={data.ytdNet >= 0 ? 'positive' : 'negative'}>
          {formatMoney(data.ytdNet, currency)}
        </p>
      </div>
      <div className="kpi-card">
        <h3>YoY balance change</h3>
        <p className={data.yoyChangeAbs != null && data.yoyChangeAbs >= 0 ? 'positive' : 'negative'}>
          {data.yoyChangeAbs != null ? formatMoney(data.yoyChangeAbs, currency) : '—'}
          {data.yoyChangePct != null && (
            <span className="muted"> ({formatChangePct(data.yoyChangePct)})</span>
          )}
        </p>
      </div>
      {accountType === 'BROKERAGE' && data.breakdown && (
        <>
          <div className="kpi-card">
            <h3>Cash allocation</h3>
            <p>
              {formatMoney(data.breakdown.cashValue, currency)}
              <span className="muted"> ({data.breakdown.cashPct.toFixed(1)}%)</span>
            </p>
          </div>
          <div className="kpi-card">
            <h3>Securities allocation</h3>
            <p>
              {formatMoney(data.breakdown.securitiesValue, currency)}
              <span className="muted"> ({data.breakdown.securitiesPct.toFixed(1)}%)</span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
