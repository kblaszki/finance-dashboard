import { useEffect, useMemo, useState } from 'react'
import { fetchExpensesByCategory } from '../../api/statsApi'
import type { CategoryAmount } from '../../api/statsApi'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { useCurrency } from '../../state/currency'
import { usePeriod } from '../../state/period'
import { useTheme } from '../../state/theme'
import { formatMoney } from '../../utils/format'

const CHART_COLOR_KEYS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
] as const

function getChartColors(): string[] {
  const styles = getComputedStyle(document.documentElement)
  return CHART_COLOR_KEYS.map((key) => styles.getPropertyValue(key).trim() || '#2563eb')
}

export function ExpensesByCategoryChart() {
  const [data, setData] = useState<CategoryAmount[]>([])
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const { theme } = useTheme()
  const [colors, setColors] = useState(getChartColors)

  useEffect(() => {
    void load()
  }, [currency, range.from, range.to])

  useEffect(() => {
    setColors(getChartColors())
  }, [theme])

  async function load() {
    const response = await fetchExpensesByCategory({
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
        <h2>Expenses by category</h2>
        <p className="empty-state">No expense data in the selected period.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Expenses by category</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={{ fill: 'var(--color-text)' }}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatMoney(Number(value), currency)}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
