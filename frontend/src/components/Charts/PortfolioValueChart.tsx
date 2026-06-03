import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchPortfolioValueOverTime, type PortfolioValuePeriod } from '../../api/statsApi'
import { useCurrency } from '../../state/currency'
import { usePeriod } from '../../state/period'
import { useTheme } from '../../state/theme'
import { formatMoney } from '../../utils/format'

export function PortfolioValueChart() {
  const [data, setData] = useState<PortfolioValuePeriod[]>([])
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const { theme } = useTheme()

  useEffect(() => {
    void load()
  }, [currency, range.from, range.to])

  async function load() {
    const response = await fetchPortfolioValueOverTime({
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
        <h2>Majątek maklerski w czasie</h2>
        <p className="empty-state">Brak danych w wybranym okresie.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Majątek maklerski w czasie</h2>
      <p className="loading-state" style={{ marginBottom: '0.75rem' }}>
        Suma wszystkich kont maklerskich (gotówka + wycena papierów wg historii cen).
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="period" stroke="var(--color-text-muted)" />
          <YAxis stroke="var(--color-text-muted)" />
          <Tooltip
            formatter={(value) => formatMoney(Number(value), currency)}
            contentStyle={tooltipStyle}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="securitiesValue"
            stackId="1"
            name="Papiery"
            fill="var(--chart-2)"
            stroke="var(--chart-2)"
          />
          <Area
            type="monotone"
            dataKey="cashValue"
            stackId="1"
            name="Gotówka"
            fill="var(--chart-3)"
            stroke="var(--chart-3)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
