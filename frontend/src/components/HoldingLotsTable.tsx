import { useCallback, useState } from 'react'
import {
  createHoldingLot,
  deleteHoldingLot,
  fetchHoldingLots,
  type HoldingLot,
} from '../api/holdingLotsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type Props = {
  holdingId: number
  currency: string
  onLotsChange?: () => void
}

export function HoldingLotsTable({ holdingId, currency, onLotsChange }: Props) {
  const loader = useCallback(() => fetchHoldingLots(holdingId), [holdingId])
  const { data: lots, error, loading, reload } = useAsyncData(loader)
  const [formError, setFormError] = useState<string | null>(null)
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState(1)
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    try {
      await createHoldingLot(holdingId, {
        side,
        quantity,
        pricePerUnit,
        currency,
        tradeDate: new Date(tradeDate).toISOString(),
      })
      reload()
      onLotsChange?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save lot')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this lot?')) return
    setFormError(null)
    try {
      await deleteHoldingLot(id)
      reload()
      onLotsChange?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const rows = lots ?? []
  const bannerError = formError ?? error

  return (
    <div>
      {bannerError && <p className="error-banner">{bannerError}</p>}
      <form className="card inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <input type="number" step="any" min="0" value={pricePerUnit} onChange={(e) => setPricePerUnit(Number(e.target.value))} placeholder="Price per unit" />
        <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
        <button type="submit" className="btn-primary">Add lot</button>
      </form>
      {loading && !lots ? (
        <p className="muted">Loading lots…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No trades yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Side</th>
              <th>Qty</th>
              <th>After</th>
              <th>Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((l: HoldingLot) => (
              <tr key={l.id}>
                <td>{new Date(l.tradeDate).toLocaleDateString('en-US')}</td>
                <td>{l.side}</td>
                <td>{l.quantity}</td>
                <td>{l.quantityAfter}</td>
                <td>{formatMoney(l.totalPrice ?? l.pricePerUnit ?? 0, l.currency)}</td>
                <td>
                  <button type="button" className="btn-link danger" onClick={() => void handleDelete(l.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
