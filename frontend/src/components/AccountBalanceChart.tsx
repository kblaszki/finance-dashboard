import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BalanceHistoryPoint } from '../api/accountsApi'
import { formatMoney } from '../utils/format'

type Props = {
  points: BalanceHistoryPoint[]
  currency: string
}

export function AccountBalanceChart({ points, currency }: Props) {
  if (!points.length) {
    return <p className="muted">No balance history to display.</p>
  }

  const data = points.map((p) => ({
    date: new Date(p.date).toLocaleDateString('en-US'),
    balance: p.balance,
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
          <Line type="monotone" dataKey="balance" stroke="var(--accent, #60a5fa)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
