import { useMemo } from 'react'
import {
  fetchExpensesByCategory,
  fetchIncomeByCategory,
  type CategoryAmount,
} from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCashFlow } from '../state/cashflow'
import { useCurrency } from '../state/currency'
import { usePeriod } from '../state/period'
import { formatMoney } from '../utils/format'

export function CategoryBreakdownSection() {
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const { stats } = useCashFlow()

  const params = useMemo(
    () => ({ from: range.from, to: range.to, currency }),
    [range.from, range.to, currency],
  )

  const expenseLoader = useMemo(
    () => () => fetchExpensesByCategory(params),
    [params],
  )
  const incomeLoader = useMemo(
    () => () => fetchIncomeByCategory(params),
    [params],
  )

  const { data: expenses, loading: loadingExp } = useAsyncData(expenseLoader)
  const { data: income, loading: loadingInc } = useAsyncData(incomeLoader)

  const topExpenses = (expenses ?? []).slice(0, 8)
  const topIncome = (income ?? []).slice(0, 5)
  const expenseTotal = topExpenses.reduce((s, r) => s + r.amount, 0)

  return (
    <section className="card">
      <h2>By category (FR-016)</h2>
      <p className="muted">
        Period net: {stats ? formatMoney(stats.net, stats.currency) : '…'}
      </p>
      <div className="two-col-grid">
        <div>
          <h3>Top expenses</h3>
          {loadingExp && !expenses ? (
            <p className="muted">Loading…</p>
          ) : topExpenses.length === 0 ? (
            <p className="muted">No expenses in this period.</p>
          ) : (
            <ul className="category-breakdown-list">
              {topExpenses.map((row: CategoryAmount) => (
                <li key={row.category}>
                  <span>{row.category}</span>
                  <span>
                    {formatMoney(row.amount, currency)}
                    {expenseTotal > 0 ? ` (${((row.amount / expenseTotal) * 100).toFixed(0)}%)` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Top income</h3>
          {loadingInc && !income ? (
            <p className="muted">Loading…</p>
          ) : topIncome.length === 0 ? (
            <p className="muted">No income in this period.</p>
          ) : (
            <ul className="category-breakdown-list">
              {topIncome.map((row: CategoryAmount) => (
                <li key={row.category}>
                  <span>{row.category}</span>
                  <span>{formatMoney(row.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
