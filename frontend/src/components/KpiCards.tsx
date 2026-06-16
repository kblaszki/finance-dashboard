import { useEffect, useState } from 'react'
import { fetchCashflow } from '../api/statsApi'
import { usePeriod } from '../state/period'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

export function KpiCards() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchCashflow>> | null>(null)
  const { currency } = useCurrency()
  const { range } = usePeriod()

  useEffect(() => {
    void fetchCashflow({ from: range.from, to: range.to }).then(setStats)
  }, [range.from, range.to])

  if (!stats) {
    return <p className="loading-state">Loading KPIs…</p>
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
