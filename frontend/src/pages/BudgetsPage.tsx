import { useCallback, useState } from 'react'
import { deleteBudget, fetchBudgets, upsertBudget, type Budget } from '../api/budgetsApi'
import { CategoryPicker } from '../components/CategoryPicker'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function BudgetsPage() {
  const { currency } = useCurrency()
  const [month, setMonth] = useState(currentMonthKey())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [amount, setAmount] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  const loader = useCallback(() => fetchBudgets(month, currency), [month, currency])
  const { data: budgets, error, loading, reload } = useAsyncData(loader)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) {
      setFormError('Select a category')
      return
    }
    setFormError(null)
    try {
      await upsertBudget({
        categoryId,
        budgetMonth: `${month}-01`,
        amount,
        currency,
      })
      setAmount(0)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save budget')
    }
  }

  async function handleDelete(row: Budget) {
    if (!confirm('Delete this budget?')) return
    setFormError(null)
    try {
      await deleteBudget(row.id)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete budget')
    }
  }

  const bannerError = formError ?? error

  return (
    <div className="page">
      <h1 className="page-title">Budgets</h1>
      <p className="muted page-lead">Monthly spending limits per category (FR-017).</p>
      {bannerError && <p className="error-banner">{bannerError}</p>}

      <section className="card">
        <h2>Month</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </section>

      <section className="card">
        <h2>Set budget</h2>
        <form className="inline-form" onSubmit={(e) => void handleSave(e)}>
          <CategoryPicker
            value={categoryId}
            onChange={(id) => setCategoryId(id)}
            allowEmpty
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Limit"
            required
          />
          <button type="submit" className="btn-primary">Save</button>
        </form>
      </section>

      <section className="card">
        <h2>Budgets ({loading && !budgets ? '…' : budgets?.length ?? 0})</h2>
        {!budgets?.length ? (
          <p className="muted">No budgets for this month.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Limit</th>
                  <th>Spent</th>
                  <th>% used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {budgets.map((row: Budget) => (
                  <tr key={row.id}>
                    <td>{row.categoryName ?? row.categoryId}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{row.spent != null ? formatMoney(row.spent, row.currency) : '—'}</td>
                    <td>{row.pctUsed != null ? `${row.pctUsed.toFixed(0)}%` : '—'}</td>
                    <td className="table-actions">
                      <button type="button" className="btn-link danger" onClick={() => void handleDelete(row)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
