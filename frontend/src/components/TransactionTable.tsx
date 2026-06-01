import { useEffect, useState } from 'react'
import type {
  Transaction,
  TransactionInput,
  TransactionType,
} from '../api/transactionsApi'
import { createTransaction, fetchTransactions } from '../api/transactionsApi'
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

export function TransactionTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<TransactionInput>(emptyForm)
  const { currency: displayCurrency } = useCurrency()

  useEffect(() => {
    void load()
  }, [displayCurrency])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchTransactions({ currency: displayCurrency })
      setTransactions(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createTransaction(form)
    setForm(emptyForm)
    await load()
  }

  return (
    <div className="card">
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
            value={form.amount}
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
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label>
          Data
          <input
            type="date"
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
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

