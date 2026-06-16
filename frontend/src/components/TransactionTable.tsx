import { useEffect, useState } from 'react'
import type { Transaction, TransactionInput, TransactionType } from '../api/transactionsApi'
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
} from '../api/transactionsApi'
import { fetchAccounts, type Account } from '../api/accountsApi'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const emptyForm: TransactionInput = {
  accountId: 0,
  transactionType: 'EXPENSE',
  amount: 0,
  currency: 'PLN',
  category: 'Uncategorized',
  date: new Date().toISOString().slice(0, 10),
  description: '',
}

export function TransactionTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<TransactionInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAccountId, setFilterAccountId] = useState('')

  useEffect(() => {
    void fetchAccounts().then(setAccounts).catch(() => {})
  }, [])

  useEffect(() => {
    void load()
  }, [filterFrom, filterTo, filterAccountId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setTransactions(
        await fetchTransactions({
          from: filterFrom || undefined,
          to: filterTo || undefined,
          accountId: filterAccountId ? Number(filterAccountId) : undefined,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.amount <= 0 || !form.accountId) {
      setError('Amount and account required')
      return
    }
    setError(null)
    try {
      await createTransaction({
        ...form,
        date: new Date(form.date).toISOString(),
      })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete transaction?')) return
    await deleteTransaction(id)
    await load()
  }

  return (
    <div>
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>Add transaction</h2>
        <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
          <select
            value={form.accountId || ''}
            onChange={(e) => setForm({ ...form, accountId: Number(e.target.value) })}
            required
          >
            <option value="">Account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={form.transactionType}
            onChange={(e) => setForm({ ...form, transactionType: e.target.value as TransactionType })}
          >
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER_IN">Transfer in</option>
            <option value="TRANSFER_OUT">Transfer out</option>
          </select>
          <input
            type="number"
            step="0.01"
            value={form.amount || ''}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            placeholder="Amount"
            required
          />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Filters</h2>
        <div className="inline-form">
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Transactions {loading ? '…' : `(${transactions.length})`}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Type</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Balance after</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.date).toLocaleDateString('en-US')}</td>
                <td>{accounts.find((a) => a.id === t.accountId)?.name ?? t.accountId}</td>
                <td>{t.transactionType}</td>
                <td>{t.category}</td>
                <td>{formatMoney(t.amount, t.currency)}</td>
                <td>{formatMoney(t.balanceAfter, t.currency)}</td>
                <td>
                  <button type="button" className="btn-link danger" onClick={() => void handleDelete(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
