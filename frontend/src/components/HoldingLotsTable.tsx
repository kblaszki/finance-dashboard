import { useEffect, useState } from 'react'
import {
  createHoldingLot,
  deleteHoldingLot,
  fetchHoldingLots,
  type HoldingLot,
} from '../api/holdingLotsApi'
import { InstrumentPicker } from './InstrumentPicker'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  currency: string
  onLotsChange?: () => void
}

export function HoldingLotsTable({ accountId, currency, onLotsChange }: Props) {
  const [lots, setLots] = useState<HoldingLot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [instrumentId, setInstrumentId] = useState<number | null>(null)
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState(1)
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    void load()
  }, [accountId])

  async function load() {
    setError(null)
    try {
      setLots(await fetchHoldingLots(accountId))
      onLotsChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lots')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!instrumentId) {
      setError('Select an instrument')
      return
    }
    setError(null)
    try {
      await createHoldingLot(accountId, {
        instrumentId,
        side,
        quantity,
        pricePerUnit,
        currency,
        tradeDate: new Date(tradeDate).toISOString(),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lot')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this lot?')) return
    try {
      await deleteHoldingLot(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      {error && <p className="error-banner">{error}</p>}
      <form className="card inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <InstrumentPicker value={instrumentId} onChange={setInstrumentId} />
        <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <input type="number" step="any" min="0" value={pricePerUnit} onChange={(e) => setPricePerUnit(Number(e.target.value))} placeholder="Price per unit" />
        <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
        <button type="submit" className="btn-primary">Add lot</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Instrument</th>
            <th>Side</th>
            <th>Qty</th>
            <th>After</th>
            <th>Price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.tradeDate).toLocaleDateString('en-US')}</td>
              <td>{l.instrument?.symbol ?? l.instrumentId}</td>
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
    </div>
  )
}
