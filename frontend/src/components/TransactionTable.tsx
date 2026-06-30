import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Transaction, TransactionInput, TransactionType } from '../api/transactionsApi'
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '../api/transactionsApi'
import { fetchAccounts, type Account, type AccountType } from '../api/accountsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

type Props = {
  accountId?: number
  accountCurrency?: string
  accountType?: AccountType
  showFilters?: boolean
  showAccountColumn?: boolean
  title?: string
  hideList?: boolean
  showBankCashFilters?: boolean
  groupByCategory?: boolean
}

type CashFlowTab = 'ALL' | 'INCOME' | 'EXPENSE'

const INCOME_TYPES = new Set(['INCOME', 'DIVIDEND', 'INTEREST'])
const EXPENSE_TYPES = new Set(['EXPENSE'])

function matchesCashFlowTab(transactionType: string, category: string, tab: CashFlowTab): boolean {
  if (tab === 'ALL') return true
  if (category === 'INTERNAL_TRANSFER') return false
  if (tab === 'INCOME') return INCOME_TYPES.has(transactionType)
  return EXPENSE_TYPES.has(transactionType)
}

const BASE_TRANSACTION_TYPES: Array<{ value: TransactionType; label: string }> = [
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'TRANSFER_IN', label: 'Transfer in' },
  { value: 'TRANSFER_OUT', label: 'Transfer out' },
]

const DIVIDEND_TYPE = { value: 'DIVIDEND' as const, label: 'Dividend' }
const INTEREST_TYPE = { value: 'INTEREST' as const, label: 'Interest' }

function transactionTypesForAccount(accountType?: AccountType) {
  const types = [...BASE_TRANSACTION_TYPES]
  if (accountType === 'BROKERAGE') {
    types.push(DIVIDEND_TYPE, INTEREST_TYPE)
  } else if (accountType === 'BANK') {
    types.push(INTEREST_TYPE)
  }
  return types
}

function defaultCategoryForType(type: TransactionType): string | null {
  if (type === 'DIVIDEND') return 'DIVIDEND'
  if (type === 'INTEREST') return 'INTEREST'
  return null
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
  accountType: fixedAccountType,
  showFilters = true,
  showAccountColumn = true,
  title = 'Transactions',
  hideList = false,
  showBankCashFilters = false,
  groupByCategory = false,
}: Props) {
  const { data: accounts, error: accountsError } = useAsyncData(fetchAccounts)
  const [form, setForm] = useState<TransactionInput>(() => emptyForm(fixedAccountId ?? 0, accountCurrency ?? 'PLN'))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAccountId, setFilterAccountId] = useState(fixedAccountId ? String(fixedAccountId) : '')
  const [cashFlowTab, setCashFlowTab] = useState<CashFlowTab>('ALL')
  const [filterCategory, setFilterCategory] = useState('')
  const [categoryGrouped, setCategoryGrouped] = useState(groupByCategory)

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
  const allTransactionRows = transactions ?? []
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>()
    for (const row of allTransactionRows) {
      if (row.category) categories.add(row.category)
    }
    return [...categories].sort((a, b) => a.localeCompare(b))
  }, [allTransactionRows])
  const transactionRows = useMemo(() => {
    return allTransactionRows.filter((row) => {
      if (showBankCashFilters && !matchesCashFlowTab(row.transactionType, row.category, cashFlowTab)) {
        return false
      }
      if (filterCategory && row.category !== filterCategory) return false
      return true
    })
  }, [allTransactionRows, showBankCashFilters, cashFlowTab, filterCategory])

  type CategoryGroup = { category: string; rows: Transaction[]; subtotal: number; currency: string }

  const categoryGroups = useMemo((): CategoryGroup[] | null => {
    if (!categoryGrouped || !showBankCashFilters) return null
    const byCategory = new Map<string, Transaction[]>()
    for (const row of transactionRows) {
      const key = row.category || 'Uncategorized'
      const list = byCategory.get(key) ?? []
      list.push(row)
      byCategory.set(key, list)
    }
    const currency = accountCurrency ?? transactionRows[0]?.currency ?? 'PLN'
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, rows]) => ({
        category,
        rows: [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        subtotal: rows.reduce((sum, r) => sum + r.amount, 0),
        currency,
      }))
  }, [categoryGrouped, showBankCashFilters, transactionRows, accountCurrency])
  const bannerError = formError ?? transactionsError ?? accountsError
  const lockAccount = fixedAccountId != null
  const selectedAccount =
    accountRows.find((a) => a.id === (fixedAccountId ?? form.accountId)) ?? null
  const effectiveAccountType = fixedAccountType ?? selectedAccount?.accountType
  const transactionTypeOptions = transactionTypesForAccount(effectiveAccountType)

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
            onChange={(e) => {
              const transactionType = e.target.value as TransactionType
              const categoryDefault = defaultCategoryForType(transactionType)
              setForm({
                ...form,
                transactionType,
                ...(categoryDefault ? { category: categoryDefault } : {}),
              })
            }}
          >
            {transactionTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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

      {showBankCashFilters && lockAccount && (
        <section className="card">
          <h2>Cash flow view</h2>
          <div className="inline-form">
            <select value={cashFlowTab} onChange={(e) => setCashFlowTab(e.target.value as CashFlowTab)}>
              <option value="ALL">All</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expenses</option>
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={categoryGrouped}
                onChange={(e) => setCategoryGrouped(e.target.checked)}
              />
              Group by category
            </label>
          </div>
        </section>
      )}

      {!hideList && (
        <section className="card">
          <h2>{title} ({loading ? '…' : transactionRows.length})</h2>
          {loading && !transactions ? (
            <p className="muted">Loading transactions…</p>
          ) : transactionRows.length === 0 ? (
            <p className="muted">No transactions match the current filters.</p>
          ) : categoryGroups ? (
            <div className="table-wrap">
              {categoryGroups.map((group) => (
                <div key={group.category} className="category-group">
                  <h3>
                    {group.category}{' '}
                    <span className="muted">
                      ({group.rows.length} · subtotal {formatMoney(group.subtotal, group.currency)})
                    </span>
                  </h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Balance after</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((t: Transaction) => (
                        <tr key={t.id}>
                          <td>{new Date(t.date).toLocaleDateString('en-US')}</td>
                          <td>{t.transactionType}</td>
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
              ))}
            </div>
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
      )}
    </div>
  )
}
