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

const emptyForm: TransactionInput = {
  type: 'EXPENSE',
  amount: 0,
  currency: 'PLN',
  category: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
}

function toInput(t: Transaction): TransactionInput {
  return {
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    category: t.category,
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
  const { currency: displayCurrency } = useCurrency()

  useEffect(() => {
    void load()
  }, [displayCurrency, filterType, filterFrom, filterTo])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTransactions({
        currency: displayCurrency,
        type: filterType || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      })
      setTransactions(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.amount <= 0 || !form.category.trim()) {
      setError('Kwota musi być > 0 i kategoria jest wymagana')
      return
    }
    setError(null)
    try {
      await createTransaction({ ...form, category: form.category.trim() })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać')
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
    if (editForm.amount <= 0 || !editForm.category.trim()) {
      setError('Kwota musi być > 0 i kategoria jest wymagana')
      return
    }
    setError(null)
    try {
      await updateTransaction(editingId, {
        ...editForm,
        category: editForm.category.trim(),
      })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Usunąć tę transakcję?')) return
    setError(null)
    try {
      await deleteTransaction(id)
      if (editingId === id) setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć')
    }
  }

  return (
    <div className="card">
      <div className="transaction-filters">
        <label>
          Typ
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as '' | TransactionType)}
          >
            <option value="">Wszystkie</option>
            <option value="INCOME">Przychód</option>
            <option value="EXPENSE">Wydatek</option>
          </select>
        </label>
        <label>
          Od
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </label>
        <label>
          Do
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </label>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Typ
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as TransactionType })
            }
          >
            <option value="INCOME">Przychód</option>
            <option value="EXPENSE">Wydatek</option>
          </select>
        </label>
        <label>
          Kwota
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
          Waluta
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
        <label>
          Kategoria
          <input
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label>
          Data
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label className="form-full-width">
          Opis
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Dodaj transakcję
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="loading-state">Ładowanie...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Typ</th>
                <th>Kategoria</th>
                <th>Kwota</th>
                <th>Waluta</th>
                <th>Kwota (wybrana)</th>
                <th>Opis</th>
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
                          Typ
                          <select
                            value={editForm.type}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                type: e.target.value as TransactionType,
                              })
                            }
                          >
                            <option value="INCOME">Przychód</option>
                            <option value="EXPENSE">Wydatek</option>
                          </select>
                        </label>
                        <label>
                          Kwota
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
                          Waluta
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
                          Kategoria
                          <input
                            required
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Data
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
                          Opis
                          <input
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                          />
                        </label>
                        <div className="form-actions">
                          <button type="button" className="btn-secondary" onClick={cancelEdit}>
                            Anuluj
                          </button>
                          <button type="submit" className="btn-primary">
                            Zapisz
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString()}</td>
                    <td>{t.type === 'INCOME' ? 'Przychód' : 'Wydatek'}</td>
                    <td>{t.category}</td>
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
                        Edytuj
                      </button>{' '}
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => void handleDelete(t.id)}
                      >
                        Usuń
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
