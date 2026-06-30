import { useEffect, useState } from 'react'
import { fetchAccounts, type Account } from '../api/accountsApi'
import {
  createIncomeEvent,
  deleteIncomeEvent,
  fetchIncomeEvents,
  updateIncomeEvent,
  type IncomeEvent,
  type IncomeEventInput,
  type IncomeEventType,
  type IncomeTaxType,
} from '../api/incomeEventsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const EVENT_TYPES: IncomeEventType[] = [
  'dividend',
  'interest',
  'coupon',
  'capital_gain_distribution',
]

const TAX_TYPES: IncomeTaxType[] = ['belka', 'pit38', 'exempt']

function emptyForm(accountId: number, currency: string): IncomeEventInput {
  return {
    accountId,
    eventType: 'dividend',
    amount: 0,
    currency,
    date: new Date().toISOString().slice(0, 10),
    description: '',
  }
}

export function IncomeEventsPage() {
  const { data: accounts } = useAsyncData(fetchAccounts)
  const { data: events, error, loading, reload } = useAsyncData(fetchIncomeEvents)
  const [form, setForm] = useState<IncomeEventInput>(() => emptyForm(0, 'PLN'))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (accounts?.length && !form.accountId) {
      setForm((current) => ({
        ...current,
        accountId: accounts[0].id,
        currency: accounts[0].currency,
      }))
    }
  }, [accounts, form.accountId])

  function resetForm() {
    const account = accounts?.[0]
    setForm(emptyForm(account?.id ?? 0, account?.currency ?? 'PLN'))
    setEditingId(null)
  }

  function startEdit(row: IncomeEvent) {
    setEditingId(row.id)
    setForm({
      accountId: row.accountId,
      instrumentId: row.instrumentId,
      eventType: row.eventType,
      taxType: row.taxType,
      amount: row.amount,
      currency: row.currency,
      date: row.occurredOn.slice(0, 10),
      description: row.description ?? '',
      withheldTax: row.withheldTax,
      sourceCountry: row.sourceCountry,
      foreignTaxPaid: row.foreignTaxPaid,
    })
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.accountId || form.amount <= 0) {
      setFormError('Account and positive amount required')
      return
    }
    setFormError(null)
    try {
      if (editingId) {
        await updateIncomeEvent(editingId, form)
      } else {
        await createIncomeEvent(form)
      }
      resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete income event?')) return
    try {
      await deleteIncomeEvent(id)
      if (editingId === id) resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const rows = events ?? []
  const accountRows = accounts ?? []

  return (
    <div className="page">
      <h1 className="page-title">Income events (FR-024)</h1>
      <p className="muted page-lead">
        Dividends, interest, and coupons for tax reporting. Prefer income events over duplicate bank
        transactions.
      </p>
      {(formError || error) && <p className="error-banner">{formError ?? error}</p>}

      <section className="card">
        <h2>{editingId ? 'Edit event' : 'Add event'}</h2>
        <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
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
          <select
            value={form.eventType}
            onChange={(e) => setForm({ ...form, eventType: e.target.value as IncomeEventType })}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={form.taxType ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                taxType: e.target.value ? (e.target.value as IncomeTaxType) : null,
              })
            }
          >
            <option value="">Default tax type</option>
            {TAX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
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
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
          />
          <input
            type="number"
            step="0.01"
            value={form.withheldTax ?? ''}
            onChange={(e) =>
              setForm({ ...form, withheldTax: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Withheld tax"
          />
          <input
            value={form.sourceCountry ?? ''}
            onChange={(e) => setForm({ ...form, sourceCountry: e.target.value || null })}
            placeholder="Source country (US)"
          />
          <button type="submit" className="btn-primary">{editingId ? 'Save' : 'Add'}</button>
          {editingId && (
            <button type="button" className="btn-link" onClick={resetForm}>
              Cancel
            </button>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Events</h2>
        {loading && !events ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No income events yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Tax</th>
                  <th>Amount</th>
                  <th>Withheld</th>
                  <th>Country</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.occurredOn).toLocaleDateString('en-US')}</td>
                    <td>{row.accountName}</td>
                    <td>{row.eventType}</td>
                    <td>{row.taxType ?? '—'}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{formatMoney(row.withheldTax, row.currency)}</td>
                    <td>{row.sourceCountry ?? row.instrumentCountry ?? '—'}</td>
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
