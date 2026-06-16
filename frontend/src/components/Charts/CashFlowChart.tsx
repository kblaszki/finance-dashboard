import { useEffect, useState } from 'react'
import { fetchCashflow } from '../../api/statsApi'
import { usePeriod } from '../../state/period'
import { useCurrency } from '../../state/currency'
import { formatMoney } from '../../utils/format'

export function CashFlowChart() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchCashflow>> | null>(null)
  const { currency } = useCurrency()
  const { range } = usePeriod()

  useEffect(() => {
    void fetchCashflow({ from: range.from, to: range.to }).then(setStats)
  }, [range.from, range.to])

  if (!stats) {
    return (
      <div className="card">
        <h2>Cash flow (period)</h2>
        <p className="empty-state">Loading…</p>
      </div>
    )
  }

  const data = [
    { name: 'Income', value: stats.income },
    { name: 'Expenses', value: stats.expense },
    { name: 'Net', value: stats.net },
  ]

  return (
    <div className="card">
      <h2>Cash flow (period)</h2>
      <ul>
        {data.map((row) => (
          <li key={row.name}>
            {row.name}: {formatMoney(row.value, currency)}
          </li>
        ))}
      </ul>
    </div>
  )
}
