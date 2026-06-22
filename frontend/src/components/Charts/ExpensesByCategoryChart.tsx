import { useCallback } from 'react'
import { fetchExpensesByCategory } from '../../api/statsApi'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { useAsyncData } from '../../hooks/useAsyncData'
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
  const { currency } = useCurrency()
  const { range } = usePeriod()
  useTheme()
  const loader = useCallback(
    () =>
      fetchExpensesByCategory({
        from: range.from,
        to: range.to,
        currency,
      }),
    [currency, range.from, range.to],
  )
  const { data, error, loading } = useAsyncData(loader)
  const colors = getChartColors()

  if (error) {
    return (
      <div className="card">
        <h2>Expenses by category</h2>
        <p className="auth-error">{error}</p>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="card">
        <h2>Expenses by category</h2>
        <p className="loading-state">Loading…</p>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card">
        <h2>Expenses by category</h2>
        <p className="empty-state">No expense data in the selected period.</p>
      </div>
    )
  }

  const tooltipStyle = {
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--color-surface')
      .trim(),
    border: `1px solid ${getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim()}`,
    borderRadius: '0.5rem',
    color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
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
