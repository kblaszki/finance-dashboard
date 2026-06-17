import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AccountValuationPoint } from '../api/accountsApi'
import { formatMoney } from '../utils/format'

type Props = {
  points: AccountValuationPoint[]
  currency: string
  showComponents?: boolean
}

export function AccountBalanceChart({ points, currency, showComponents }: Props) {
  if (!points.length) {
    return <p className="muted">No balance history to display.</p>
  }

  const data = points.map((p) => ({
    date: new Date(p.valuationDate).toLocaleDateString('en-US'),
    totalValue: p.totalValue,
    cashValue: p.cashValue,
    securitiesValue: p.securitiesValue,
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
          <Line type="monotone" dataKey="totalValue" name="Total" stroke="var(--color-accent)" dot={false} />
          {showComponents && (
            <>
              <Line type="monotone" dataKey="cashValue" name="Cash" stroke="var(--chart-2)" dot={false} />
              <Line type="monotone" dataKey="securitiesValue" name="Securities" stroke="var(--chart-3)" dot={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
