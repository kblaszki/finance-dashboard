import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Transaction, TransactionInput, TransactionType } from '../api/transactionsApi'
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '../api/transactionsApi'
import { fetchAccounts, type Account } from '../api/accountsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

type Props = {
  accountId?: number
  accountCurrency?: string
  showFilters?: boolean
  showAccountColumn?: boolean
  title?: string
}

function emptyForm(accountId: number, currency: string): TransactionInput {
  return {
    accountId,
    transactionType: 'EXPENSE',
    amount: 0,
    currency,
    category: 'Uncategorized',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  }
}

export function TransactionTable({
  accountId: fixedAccountId,
  accountCurrency,
  showFilters = true,
  showAccountColumn = true,
  title = 'Transactions',
}: Props) {
  const { data: accounts, error: accountsError } = useAsyncData(fetchAccounts)
  const [form, setForm] = useState<TransactionInput>(() => emptyForm(fixedAccountId ?? 0, accountCurrency ?? 'PLN'))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAccountId, setFilterAccountId] = useState(fixedAccountId ? String(fixedAccountId) : '')

  useEffect(() => {
    if (fixedAccountId) {
      setFilterAccountId(String(fixedAccountId))
      setForm((current) => ({
        ...current,
        accountId: fixedAccountId,
        currency: accountCurrency ?? current.currency,
      }))
    }
  }, [fixedAccountId, accountCurrency])

  const transactionLoader = useCallback(
    () =>
      fetchTransactions({
        from: filterFrom || undefined,
        to: filterTo || undefined,
        accountId: filterAccountId ? Number(filterAccountId) : fixedAccountId,
      }),
    [filterFrom, filterTo, filterAccountId, fixedAccountId],
  )
  const {
    data: transactions,
    error: transactionsError,
    loading,
    reload,
  } = useAsyncData(transactionLoader)

  useEffect(() => {
    if (accounts?.length && !form.accountId && !fixedAccountId) {
      setForm((current) => ({ ...current, accountId: accounts[0].id, currency: accounts[0].currency }))
    }
  }, [accounts, form.accountId, fixedAccountId])

  function resetForm() {
    const accountId = fixedAccountId ?? accounts?.[0]?.id ?? 0
    const currency = accountCurrency ?? accounts?.find((a) => a.id === accountId)?.currency ?? 'PLN'
    setForm(emptyForm(accountId, currency))
    setEditingId(null)
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setForm({
      accountId: t.accountId,
      transactionType: t.transactionType,
      amount: t.amount,
      currency: t.currency,
      category: t.category,
      date: t.date.slice(0, 10),
      description: t.description ?? '',
    })
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.amount <= 0 || !form.accountId) {
      setFormError('Amount and account required')
      return
    }
    setFormError(null)
    try {
      const payload = {
        ...form,
        date: new Date(form.date).toISOString(),
      }
      if (editingId) {
        await updateTransaction(editingId, payload)
      } else {
        await createTransaction(payload)
      }
      resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete transaction?')) return
    setFormError(null)
    try {
      await deleteTransaction(id)
      if (editingId === id) resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const accountRows = accounts ?? []
  const transactionRows = transactions ?? []
  const bannerError = formError ?? transactionsError ?? accountsError
  const lockAccount = fixedAccountId != null

  return (
    <div className="page-stack">
      {bannerError && <p className="error-banner">{bannerError}</p>}

      <section className="card">
        <h2>{editingId ? 'Edit transaction' : 'Add transaction'}</h2>
        <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
          {!lockAccount && (
            <select
              value={form.accountId || ''}
              onChange={(e) => setForm({ ...form, accountId: Number(e.target.value) })}
              required
            >
              <option value="">Account</option>
              {accountRows.map((a: Account) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
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
          <button type="submit" className="btn-primary">{editingId ? 'Save' : 'Add'}</button>
          {editingId && (
            <button type="button" className="btn-link" onClick={resetForm}>Cancel</button>
          )}
        </form>
      </section>

      {showFilters && !lockAccount && (
        <section className="card">
          <h2>Filters</h2>
          <div className="inline-form">
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accountRows.map((a: Account) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {showFilters && lockAccount && (
        <section className="card">
          <h2>Filters</h2>
          <div className="inline-form">
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
          <p className="muted">
            <Link to={`/transactions?accountId=${fixedAccountId}`}>All transactions for this account</Link>
          </p>
        </section>
      )}

      <section className="card">
        <h2>{title} ({loading ? '…' : transactionRows.length})</h2>
        {loading && !transactions ? (
          <p className="muted">Loading transactions…</p>
        ) : transactionRows.length === 0 ? (
          <p className="muted">No transactions match the current filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {showAccountColumn && !lockAccount && <th>Account</th>}
                <th>Type</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Balance after</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactionRows.map((t: Transaction) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('en-US')}</td>
                  {showAccountColumn && !lockAccount && (
                    <td>{accountRows.find((a) => a.id === t.accountId)?.name ?? t.accountId}</td>
                  )}
                  <td>{t.transactionType}</td>
                  <td>{t.category}</td>
                  <td>{formatMoney(t.amount, t.currency)}</td>
                  <td>{formatMoney(t.balanceAfter, t.currency)}</td>
                  <td className="table-actions">
                    <button type="button" className="btn-link" onClick={() => startEdit(t)}>Edit</button>
                    <button type="button" className="btn-link danger" onClick={() => void handleDelete(t.id)}>
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
