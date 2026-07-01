import { useCallback, useState } from 'react'
import {
  createAssetValuation,
  deleteAssetValuation,
  fetchAssetValuations,
  type AssetValuation,
  type AssetValuationInput,
} from '../api/assetValuationsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  currency: string
  onSaved?: () => void
}

function emptyForm(accountId: number, currency: string): AssetValuationInput {
  return {
    accountId,
    value: 0,
    currency,
    date: new Date().toISOString().slice(0, 10),
    description: '',
  }
}

export function AssetValuationsSection({ accountId, currency, onSaved }: Props) {
  const loader = useCallback(() => fetchAssetValuations({ accountId }), [accountId])
  const { data: rows, error, loading, reload } = useAsyncData(loader)
  const [form, setForm] = useState<AssetValuationInput>(() => emptyForm(accountId, currency))
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.value < 0) {
      setFormError('Value must be non-negative')
      return
    }
    setFormError(null)
    try {
      await createAssetValuation(form)
      setForm(emptyForm(accountId, currency))
      await reload()
      onSaved?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save valuation')
    }
  }

  async function handleDelete(row: AssetValuation) {
    if (!window.confirm('Delete this valuation record?')) return
    try {
      await deleteAssetValuation(row.id)
      await reload()
      onSaved?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <section className="card">
      <h2>Valuation history</h2>
      <p className="muted">
        Timeline of manual asset valuations (DATA-024). Each entry updates the account balance.
      </p>
      {formError && <p className="error-banner">{formError}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Value"
          value={form.value || ''}
          onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
          required
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <button type="submit" className="btn-primary">
          Add valuation
        </button>
      </form>

      {loading && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && !loading && <p className="muted">No valuations yet.</p>}
      {rows && rows.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.valuedOn.slice(0, 10)}</td>
                <td>{formatMoney(row.value, row.currency)}</td>
                <td>{row.description ?? '—'}</td>
                <td>
                  <button type="button" className="btn-link danger" onClick={() => void handleDelete(row)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
