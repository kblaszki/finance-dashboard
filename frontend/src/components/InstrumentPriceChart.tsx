import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { InstrumentValuation } from '../api/instrumentsApi'
import { formatMoney } from '../utils/format'

type Props = {
  points: InstrumentValuation[]
  currency: string
}

export function InstrumentPriceChart({ points, currency }: Props) {
  if (!points.length) {
    return <p className="muted">No price history to display.</p>
  }

  const data = points.map((p) => ({
    date: new Date(p.valuationDate).toLocaleDateString('en-US'),
    price: p.price,
  }))

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => formatMoney(Number(value ?? 0), currency)}
            labelFormatter={(label) => String(label)}
          />
          <Line type="monotone" dataKey="price" name="Price" stroke="var(--color-accent)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
