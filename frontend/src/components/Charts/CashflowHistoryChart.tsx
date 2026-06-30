import { useCallback } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchCashflowHistory } from '../../api/statsApi'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrency } from '../../state/currency'
import { usePeriod } from '../../state/period'
import { formatMoney } from '../../utils/format'

export function CashflowHistoryChart() {
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const loader = useCallback(
    () => fetchCashflowHistory({ from: range.from, to: range.to, currency }),
    [currency, range.from, range.to],
  )
  const { data, error, loading } = useAsyncData(loader)

  if (loading) {
    return (
      <div className="card">
        <h2>Income & expenses over time</h2>
        <p className="empty-state">Loading chart…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card">
        <h2>Income & expenses over time</h2>
        <p className="error-banner">{error ?? 'Failed to load cashflow history'}</p>
      </div>
    )
  }

  const chartData = data.points.map((p) => ({
    month: p.month,
    income: p.income,
    expense: p.expense,
    net: p.net,
  }))

  return (
    <div className="card">
      <h2>Income & expenses over time</h2>
      {chartData.length === 0 ? (
        <p className="muted">No data for the selected period.</p>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v: number) => formatMoney(v, currency)} width={90} />
              <Tooltip
                formatter={(value, name) =>
                  typeof value === 'number'
                    ? [formatMoney(value, currency), String(name)]
                    : ['—', String(name)]
                }
              />
              <Legend />
              <Line type="monotone" dataKey="income" name="Income" stroke="var(--chart-1)" dot={false} />
              <Line type="monotone" dataKey="expense" name="Expenses" stroke="var(--chart-3)" dot={false} />
              <Line type="monotone" dataKey="net" name="Net income" stroke="var(--chart-2)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
