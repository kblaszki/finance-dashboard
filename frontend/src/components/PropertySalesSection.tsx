import { useState } from 'react'
import {
  createPropertySale,
  deletePropertySale,
  fetchPropertySales,
  type PropertySale,
} from '../api/propertySalesApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  currency: string
}

export function PropertySalesSection({ accountId, currency }: Props) {
  const { data: sales, reload } = useAsyncData(() => fetchPropertySales({ accountId }))
  const [form, setForm] = useState({
    soldOn: new Date().toISOString().slice(0, 10),
    proceeds: 0,
    acquisitionCost: 0,
    improvementsCost: 0,
    fiveYearExemption: false,
    description: '',
  })
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createPropertySale({
        accountId,
        currency,
        ...form,
        description: form.description || null,
      })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sale')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete property sale?')) return
    await deletePropertySale(id)
    reload()
  }

  return (
    <section className="card">
      <h2>Property sales (FR-044)</h2>
      <form className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Sold on
          <input
            type="date"
            value={form.soldOn}
            onChange={(e) => setForm((f) => ({ ...f, soldOn: e.target.value }))}
          />
        </label>
        <label>
          Proceeds
          <input
            type="number"
            min={0}
            value={form.proceeds || ''}
            onChange={(e) => setForm((f) => ({ ...f, proceeds: Number(e.target.value) }))}
          />
        </label>
        <label>
          Acquisition cost
          <input
            type="number"
            min={0}
            value={form.acquisitionCost || ''}
            onChange={(e) => setForm((f) => ({ ...f, acquisitionCost: Number(e.target.value) }))}
          />
        </label>
        <label>
          Improvements
          <input
            type="number"
            min={0}
            value={form.improvementsCost || ''}
            onChange={(e) => setForm((f) => ({ ...f, improvementsCost: Number(e.target.value) }))}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.fiveYearExemption}
            onChange={(e) => setForm((f) => ({ ...f, fiveYearExemption: e.target.checked }))}
          />
          Five-year exemption
        </label>
        <button type="submit" className="btn-primary">
          Add sale
        </button>
      </form>
      {error ? <p className="error-banner">{error}</p> : null}
      <SalesTable rows={sales ?? []} currency={currency} onDelete={handleDelete} />
    </section>
  )
}

function SalesTable(props: {
  rows: PropertySale[]
  currency: string
  onDelete: (id: number) => void
}) {
  if (props.rows.length === 0) return <p className="muted">No sales recorded.</p>
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Proceeds</th>
          <th>Taxable gain</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.id}>
            <td>{row.soldOn.slice(0, 10)}</td>
            <td>{formatMoney(row.proceeds, row.currency)}</td>
            <td>{formatMoney(row.taxableGain, row.currency)}</td>
            <td>
              <button type="button" className="btn-link" onClick={() => void props.onDelete(row.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
