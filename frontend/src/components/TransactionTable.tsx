import { useEffect, useState } from 'react'
import type {
  Transaction,
  TransactionInput,
  TransactionType,
} from '../api/transactionsApi'
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '../api/transactionsApi'
import { SUPPORTED_CURRENCIES, useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'
import { fetchPortfolios, type InvestmentPortfolio } from '../api/portfoliosApi'
import { fetchAccounts, type FinancialAccount } from '../api/accountsApi'
import { fetchCategories, type CategoryNode } from '../api/categoriesApi'

const emptyForm: TransactionInput = {
  type: 'EXPENSE',
  amount: 0,
  currency: 'PLN',
  category: '',
  categoryId: null,
  accountId: null,
  date: new Date().toISOString().slice(0, 10),
  description: '',
}

function toInput(t: Transaction): TransactionInput {
  return {
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    category: t.category,
    categoryId: t.categoryId ?? null,
    accountId: t.accountId ?? null,
    portfolioId: t.portfolioId ?? null,
    date: t.date.slice(0, 10),
    description: t.description ?? '',
  }
}

export function TransactionTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<TransactionInput>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<TransactionInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'' | TransactionType>('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAccountId, setFilterAccountId] = useState('')
  const [portfolios, setPortfolios] = useState<InvestmentPortfolio[]>([])
  const [bankAccounts, setBankAccounts] = useState<FinancialAccount[]>([])
  const [expenseCategories, setExpenseCategories] = useState<CategoryNode[]>([])
  const [incomeCategories, setIncomeCategories] = useState<CategoryNode[]>([])
  const { currency: displayCurrency } = useCurrency()

  useEffect(() => {
    void load()
  }, [displayCurrency, filterType, filterFrom, filterTo, filterAccountId])

  useEffect(() => {
    void fetchPortfolios().then(setPortfolios).catch(() => {})
    void fetchAccounts('BANK').then(setBankAccounts).catch(() => {})
    void fetchCategories('EXPENSE').then(setExpenseCategories).catch(() => {})
    void fetchCategories('INCOME').then(setIncomeCategories).catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTransactions({
        currency: displayCurrency,
        type: filterType || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        accountId: filterAccountId ? Number(filterAccountId) : undefined,
      })
      setTransactions(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.amount <= 0) {
      setError('Amount must be > 0')
      return
    }
    if (form.type === 'TRANSFER_TO_PORTFOLIO' && !form.portfolioId) {
      setError('Select a target brokerage account for the transfer')
      return
    }
    if (form.type !== 'TRANSFER_TO_PORTFOLIO' && !form.categoryId && !form.category.trim()) {
      setError('Select a category')
      return
    }
    setError(null)
    try {
      const cats = form.type === 'INCOME' ? incomeCategories : expenseCategories
      const selected = form.categoryId ? cats.find((c) => c.id === form.categoryId) : null
      await createTransaction({
        ...form,
        category: selected?.path ?? form.category.trim(),
        categoryId: form.categoryId ?? null,
      })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditForm(toInput(t))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (editingId == null) return
    if (editForm.amount <= 0) {
      setError('Amount must be > 0')
      return
    }
    setError(null)
    try {
      const cats = editForm.type === 'INCOME' ? incomeCategories : expenseCategories
      const selected = editForm.categoryId ? cats.find((c) => c.id === editForm.categoryId) : null
      await updateTransaction(editingId, {
        ...editForm,
        category: selected?.path ?? editForm.category.trim(),
        categoryId: editForm.categoryId ?? null,
      })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this transaction?')) return
    setError(null)
    try {
      await deleteTransaction(id)
      if (editingId === id) setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="card">
      <div className="transaction-filters">
        <label>
          Type
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as '' | TransactionType)}
          >
            <option value="">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER_TO_PORTFOLIO">Transfer to brokerage</option>
          </select>
        </label>
        {form.type === 'TRANSFER_TO_PORTFOLIO' && (
          <label>
            Target brokerage
            <select
              value={form.portfolioId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                const selected = portfolios.find((p) => p.id === id)
                setForm({ ...form, portfolioId: id, currency: selected?.baseCurrency ?? form.currency })
              }}
            >
              <option value="">Select…</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          From
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </label>
        <label>
          Bank account
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
          >
            <option value="">All</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Type
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as TransactionType })
            }
          >
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER_TO_PORTFOLIO">Transfer to brokerage</option>
          </select>
        </label>
        {(form.type === 'INCOME' || form.type === 'EXPENSE') && (
          <label>
            Bank account
            {bankAccounts.length > 0 && !form.accountId && (
              <span className="field-warning" title="Assign the transaction to a bank account for correct balance">
                ⚠
              </span>
            )}
            <select
              value={form.accountId ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  accountId: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">— none —</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.type === 'TRANSFER_TO_PORTFOLIO' && (
          <label>
            Target brokerage
            <select
              value={form.portfolioId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                const selected = portfolios.find((p) => p.id === id)
                setForm({
                  ...form,
                  portfolioId: id,
                  currency: selected?.baseCurrency ?? form.currency,
                })
              }}
            >
              <option value="">Select…</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Amount
          <input
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.amount || ''}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          />
        </label>
        <label>
          Currency
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {form.type !== 'TRANSFER_TO_PORTFOLIO' && (
          <label>
            Category
            <select
              required
              value={form.categoryId ?? ''}
              onChange={(e) => {
                const id = e.target.value === '' ? null : Number(e.target.value)
                const cats = form.type === 'INCOME' ? incomeCategories : expenseCategories
                const node = id ? cats.find((c) => c.id === id) : null
                setForm({
                  ...form,
                  categoryId: id,
                  category: node?.path ?? '',
                })
              }}
            >
              <option value="">Select…</option>
              {(form.type === 'INCOME' ? incomeCategories : expenseCategories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Date
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label className="form-full-width">
          Description
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Add transaction
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="loading-state">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Amount (selected)</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id} className="transaction-edit-row">
                    <td colSpan={8}>
                      <form className="form-grid" onSubmit={saveEdit}>
                        <label>
                          Type
                          <select
                            value={editForm.type}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                type: e.target.value as TransactionType,
                              })
                            }
                          >
                            <option value="INCOME">Income</option>
                            <option value="EXPENSE">Expense</option>
                          </select>
                        </label>
                        <label>
                          Amount
                          <input
                            type="number"
                            min={0.01}
                            step="0.01"
                            required
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                amount: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Currency
                          <select
                            value={editForm.currency}
                            onChange={(e) =>
                              setEditForm({ ...editForm, currency: e.target.value })
                            }
                          >
                            {SUPPORTED_CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Category
                          <input
                            required
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Date
                          <input
                            type="date"
                            required
                            value={editForm.date}
                            onChange={(e) =>
                              setEditForm({ ...editForm, date: e.target.value })
                            }
                          />
                        </label>
                        <label className="form-full-width">
                          Description
                          <input
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                          />
                        </label>
                        <div className="form-actions">
                          <button type="button" className="btn-secondary" onClick={cancelEdit}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-primary">
                            Save
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString()}</td>
                    <td>{t.type === 'INCOME' ? 'Income' : t.type === 'EXPENSE' ? 'Expense' : 'Transfer to brokerage'}</td>
                    <td>
                      {t.category}
                      {(t.type === 'INCOME' || t.type === 'EXPENSE') &&
                        bankAccounts.length > 0 &&
                        !t.accountId && (
                          <span
                            className="field-warning"
                            title="No bank account — account balances exclude this transaction"
                          >
                            {' '}
                            ⚠
                          </span>
                        )}
                    </td>
                    <td>{formatMoney(t.amount, t.currency)}</td>
                    <td>{t.currency}</td>
                    <td>
                      {t.amountConverted != null && t.convertedCurrency
                        ? formatMoney(t.amountConverted, t.convertedCurrency)
                        : '—'}
                    </td>
                    <td>{t.description}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => startEdit(t)}
                      >
                        Edit
                      </button>{' '}
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => void handleDelete(t.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
