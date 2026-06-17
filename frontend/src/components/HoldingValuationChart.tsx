import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HoldingValuationPoint } from '../api/valuationsApi'
import { formatMoney } from '../utils/format'

type Props = {
  points: HoldingValuationPoint[]
  currency: string
}

export function HoldingValuationChart({ points, currency }: Props) {
  if (!points.length) {
    return <p className="muted">No position value history to display.</p>
  }

  const data = points.map((p) => ({
    date: new Date(p.valuationDate).toLocaleDateString('en-US'),
    marketValue: p.marketValue,
    quantity: p.quantity,
  }))

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) =>
              name === 'quantity'
                ? Number(value ?? 0).toLocaleString()
                : formatMoney(Number(value ?? 0), currency)
            }
            labelFormatter={(label) => String(label)}
          />
          <Line type="monotone" dataKey="marketValue" name="Market value" stroke="var(--accent, #60a5fa)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
