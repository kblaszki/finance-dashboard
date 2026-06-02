import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchCashflowOverTime } from '../../api/statsApi'
import type { CashflowPeriod } from '../../api/statsApi'
import { useCurrency } from '../../state/currency'
import { usePeriod } from '../../state/period'
import { useTheme } from '../../state/theme'
import { formatMoney } from '../../utils/format'

export function CashFlowChart() {
  const [data, setData] = useState<CashflowPeriod[]>([])
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const { theme } = useTheme()

  useEffect(() => {
    void load()
  }, [currency, range.from, range.to])

  async function load() {
    const response = await fetchCashflowOverTime({
      currency,
      from: range.from,
      to: range.to,
    })
    setData(response)
  }

  const tooltipStyle = useMemo(
    () => ({
      backgroundColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--color-surface')
        .trim(),
      border: `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim()}`,
      borderRadius: '0.5rem',
      color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
    }),
    [theme],
  )

  if (!data.length) {
    return (
      <div className="card">
        <h2>Przepływy w czasie</h2>
        <p className="empty-state">Brak danych w wybranym okresie.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Przepływy w czasie</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="period" stroke="var(--color-text-muted)" />
          <YAxis stroke="var(--color-text-muted)" />
          <Tooltip
            formatter={(value) => formatMoney(Number(value), currency)}
            contentStyle={tooltipStyle}
          />
          <Legend />
          <Bar dataKey="income" name="Przychody" fill="var(--chart-2)" />
          <Bar dataKey="expenses" name="Wydatki" fill="var(--chart-1)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
