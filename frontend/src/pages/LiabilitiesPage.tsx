import { useEffect, useState } from 'react'
import { fetchAccounts, type Account } from '../api/accountsApi'
import {
  createLiability,
  deleteLiability,
  fetchLiabilities,
  updateLiability,
  type Liability,
  type LiabilityInput,
  type LiabilityType,
} from '../api/liabilitiesApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const LIABILITY_TYPES: LiabilityType[] = [
  'mortgage',
  'loan',
  'credit',
  'tax_provision',
  'tax_advance',
]

function emptyForm(currency: string): LiabilityInput {
  return {
    name: '',
    liabilityType: 'mortgage',
    balance: 0,
    currency,
    accountId: null,
  }
}

export function LiabilitiesPage() {
  const { data: accounts } = useAsyncData(fetchAccounts)
  const { data: rows, error, loading, reload } = useAsyncData(fetchLiabilities)
  const [form, setForm] = useState<LiabilityInput>(() => emptyForm('PLN'))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (accounts?.length && form.currency === 'PLN') {
      setForm((current) => ({ ...current, currency: accounts[0]?.currency ?? 'PLN' }))
    }
  }, [accounts, form.currency])

  function resetForm() {
    setForm(emptyForm(accounts?.[0]?.currency ?? 'PLN'))
    setEditingId(null)
  }

  function startEdit(row: Liability) {
    setEditingId(row.id)
    setForm({
      name: row.name,
      liabilityType: row.liabilityType,
      balance: row.balance,
      currency: row.currency,
      accountId: row.accountId,
    })
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.balance < 0) {
      setFormError('Name and balance required')
      return
    }
    setFormError(null)
    try {
      if (editingId) {
        await updateLiability(editingId, form)
      } else {
        await createLiability(form)
      }
      resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete liability?')) return
    try {
      await deleteLiability(id)
      if (editingId === id) resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const list = rows ?? []
  const accountRows = accounts ?? []

  return (
    <div className="page">
      <h1 className="page-title">Liabilities (FR-029)</h1>
      <p className="muted page-lead">
        Mortgages, loans, and credits reduce net worth on the dashboard (assets − liabilities).
      </p>
      {(formError || error) && <p className="error-banner">{formError ?? error}</p>}

      <section className="card">
        <h2>{editingId ? 'Edit liability' : 'Add liability'}</h2>
        <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            required
          />
          <select
            value={form.liabilityType}
            onChange={(e) => setForm({ ...form, liabilityType: e.target.value as LiabilityType })}
          >
            {LIABILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.balance || ''}
            onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })}
            placeholder="Balance"
            required
          />
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={form.accountId ?? ''}
            onChange={(e) =>
              setForm({ ...form, accountId: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">No linked account</option>
            {accountRows.map((a: Account) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">{editingId ? 'Save' : 'Add'}</button>
          {editingId && (
            <button type="button" className="btn-link" onClick={resetForm}>
              Cancel
            </button>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Your liabilities</h2>
        {loading && !rows ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="muted">No liabilities recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Account</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.liabilityType}</td>
                    <td>{formatMoney(row.balance, row.currency)}</td>
                    <td>{row.accountName ?? '—'}</td>
                    <td>
                      <button type="button" className="btn-link" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-link danger"
                        onClick={() => void handleDelete(row.id)}
                      >
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
