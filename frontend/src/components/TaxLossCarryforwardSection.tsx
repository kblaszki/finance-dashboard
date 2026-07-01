import { useCallback, useState } from 'react'
import {
  deleteTaxLossCarryforward,
  fetchTaxLossCarryforwards,
  upsertTaxLossCarryforward,
  type TaxLossCarryforward,
} from '../api/taxLossCarryforwardApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

export function TaxLossCarryforwardSection() {
  const { data: rows, error, loading, reload } = useAsyncData(fetchTaxLossCarryforwards)
  const [form, setForm] = useState({
    taxYear: new Date().getFullYear() - 1,
    lossAmount: 0,
    note: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFormError(null)
      try {
        await upsertTaxLossCarryforward({
          taxYear: form.taxYear,
          lossAmount: form.lossAmount,
          note: form.note.trim() || null,
        })
        setForm((f) => ({ ...f, lossAmount: 0, note: '' }))
        await reload()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to save')
      }
    },
    [form, reload],
  )

  async function handleDelete(row: TaxLossCarryforward) {
    if (!window.confirm(`Delete ${row.taxYear} loss carryforward?`)) return
    try {
      await deleteTaxLossCarryforward(row.id)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <section className="card form-section-gap">
      <h2 className="section-title">PIT-38 loss carryforward</h2>
      <p className="muted">
        Record unused capital losses from prior years. Applied automatically in tax report and overview.
      </p>
      {formError && <p className="error-banner">{formError}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="number"
          min={2000}
          max={2100}
          value={form.taxYear}
          onChange={(e) => setForm((f) => ({ ...f, taxYear: Number(e.target.value) }))}
          aria-label="Tax year"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="Loss amount (PLN)"
          value={form.lossAmount || ''}
          onChange={(e) => setForm((f) => ({ ...f, lossAmount: Number(e.target.value) }))}
          required
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
        <button type="submit" className="btn-primary">
          Save row
        </button>
      </form>

      {loading && <p className="muted">Loading…</p>}
      {rows && rows.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Loss</th>
              <th>Used</th>
              <th>Remaining</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.taxYear}</td>
                <td>{formatMoney(row.lossAmount, 'PLN')}</td>
                <td>{formatMoney(row.usedAmount, 'PLN')}</td>
                <td>{formatMoney(row.remainingAmount, 'PLN')}</td>
                <td>{row.note ?? '—'}</td>
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
      {rows && rows.length === 0 && !loading && (
        <p className="muted">No loss carryforward rows yet.</p>
      )}
    </section>
  )
}
