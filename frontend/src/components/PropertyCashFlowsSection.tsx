import { useCallback, useMemo, useState } from 'react'
import {
  createPropertyCashFlow,
  deletePropertyCashFlow,
  fetchPropertyCashFlows,
  updatePropertyCashFlow,
  type PropertyCashFlow,
  type PropertyCashFlowInput,
  type PropertyFlowType,
} from '../api/propertyCashFlowsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  currency: string
}

const FLOW_TYPES: PropertyFlowType[] = ['rent', 'maintenance', 'other']

function emptyForm(accountId: number, currency: string): PropertyCashFlowInput {
  return {
    accountId,
    flowType: 'rent',
    amount: 0,
    currency,
    date: new Date().toISOString().slice(0, 10),
    description: '',
  }
}

export function PropertyCashFlowsSection({ accountId, currency }: Props) {
  const loader = useCallback(
    () => fetchPropertyCashFlows({ accountId }),
    [accountId],
  )
  const { data: rows, error, loading, reload } = useAsyncData(loader)
  const [form, setForm] = useState<PropertyCashFlowInput>(() => emptyForm(accountId, currency))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const totals = useMemo(() => {
    const list = rows ?? []
    let rent = 0
    let maintenance = 0
    for (const row of list) {
      if (row.flowType === 'rent') rent += row.amount
      else if (row.flowType === 'maintenance') maintenance += row.amount
    }
    return { rent, maintenance, net: rent - maintenance }
  }, [rows])

  function resetForm() {
    setForm(emptyForm(accountId, currency))
    setEditingId(null)
  }

  function startEdit(row: PropertyCashFlow) {
    setEditingId(row.id)
    setForm({
      accountId: row.accountId,
      flowType: row.flowType,
      amount: row.amount,
      currency: row.currency,
      date: row.occurredOn.slice(0, 10),
      description: row.description ?? '',
    })
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.amount <= 0) {
      setFormError('Amount must be positive')
      return
    }
    setFormError(null)
    try {
      if (editingId) {
        await updatePropertyCashFlow(editingId, form)
      } else {
        await createPropertyCashFlow(form)
      }
      resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this flow?')) return
    try {
      await deletePropertyCashFlow(id)
      if (editingId === id) resetForm()
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const list = rows ?? []

  return (
    <section className="card">
      <h2>Rental &amp; maintenance (FR-030)</h2>
      <p className="muted">
        Totals: rent {formatMoney(totals.rent, currency)}, maintenance{' '}
        {formatMoney(totals.maintenance, currency)}, net {formatMoney(totals.net, currency)}
      </p>
      {formError && <p className="error-banner">{formError}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <select
          value={form.flowType}
          onChange={(e) => setForm({ ...form, flowType: e.target.value as PropertyFlowType })}
        >
          {FLOW_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
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
        <button type="submit" className="btn-primary">{editingId ? 'Save' : 'Add'}</button>
        {editingId && (
          <button type="button" className="btn-link" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      {loading && !rows ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">No property cash flows yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.occurredOn).toLocaleDateString('en-US')}</td>
                  <td>{row.flowType}</td>
                  <td>{formatMoney(row.amount, row.currency)}</td>
                  <td>{row.description ?? '—'}</td>
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
  )
}
