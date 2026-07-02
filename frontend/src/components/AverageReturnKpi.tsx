import { useCallback } from 'react'
import { fetchAverageHoldingReturn } from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatPercent } from '../utils/format'

export function AverageReturnKpi() {
  const { currency } = useCurrency()
  const loader = useCallback(() => fetchAverageHoldingReturn(currency), [currency])
  const { data, error, loading } = useAsyncData(loader)

  if (loading) return <p className="loading-state">Loading average return…</p>
  if (error || !data) {
    return <p className="error-banner">{error ?? 'Failed to load average return'}</p>
  }

  return (
    <div className="kpi-card">
      <h3>Average return (open holdings)</h3>
      <p
        className={
          data.averageReturnPct != null && data.averageReturnPct >= 0 ? 'positive' : 'negative'
        }
      >
        {formatPercent(data.averageReturnPct, { signed: true })}
      </p>
    </div>
  )
}
