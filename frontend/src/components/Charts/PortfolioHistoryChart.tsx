import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchPortfolioHistory } from '../../api/statsApi'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrency } from '../../state/currency'
import { usePeriod } from '../../state/period'
import { formatMoney } from '../../utils/format'

export function PortfolioHistoryChart() {
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const { data, error, loading } = useAsyncData(
    () =>
      fetchPortfolioHistory({
        from: range.from,
        to: range.to,
        currency,
      }),
    [currency, range.from, range.to],
  )

  if (error) {
    return (
      <div className="card">
        <h2>Portfolio value (period)</h2>
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="card">
        <h2>Portfolio value (period)</h2>
        <p className="loading-state">Loading…</p>
      </div>
    )
  }

  if (!data.points.length) {
    return (
      <div className="card">
        <h2>Portfolio value (period)</h2>
        <p className="empty-state">No brokerage history in the selected period.</p>
      </div>
    )
  }

  const chartData = data.points.map((p) => ({
    date: new Date(p.date).toLocaleDateString('en-US'),
    totalValue: p.totalValue,
    cashValue: p.cashValue,
    securitiesValue: p.securitiesValue,
  }))

  return (
    <div className="card">
      <h2>Portfolio value (period)</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => formatMoney(Number(value ?? 0), currency)} />
            <Line type="monotone" dataKey="totalValue" name="Total" stroke="var(--color-accent)" dot={false} />
            <Line type="monotone" dataKey="securitiesValue" name="Securities" stroke="var(--chart-3)" dot={false} />
            <Line type="monotone" dataKey="cashValue" name="Cash" stroke="var(--chart-2)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
