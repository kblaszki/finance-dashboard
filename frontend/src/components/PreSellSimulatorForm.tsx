import { useState } from 'react'
import { simulatePreSellTax, type PreSellSimulation } from '../api/taxOverviewApi'
import { formatMoney } from '../utils/format'

type Props = {
  holdingId: number
  symbol: string
  maxQuantity: number
  currency: string
}

export function PreSellSimulatorForm({ holdingId, symbol, maxQuantity, currency }: Props) {
  const [quantity, setQuantity] = useState(maxQuantity > 0 ? String(maxQuantity) : '')
  const [salePrice, setSalePrice] = useState('')
  const [result, setResult] = useState<PreSellSimulation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      setError('Enter a positive quantity')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const price = salePrice ? Number(salePrice) : undefined
      const sim = await simulatePreSellTax({
        holdingId,
        quantity: qty,
        currency,
        ...(price != null && Number.isFinite(price) ? { salePricePerUnit: price } : {}),
      })
      setResult(sim)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>Pre-sell tax impact (FR-050)</h2>
      <p className="muted">Estimate FIFO gain for {symbol} before placing a sell.</p>
      <form className="form-grid" onSubmit={(e) => void handleSimulate(e)}>
        <label>
          Quantity (max {maxQuantity})
          <input
            type="number"
            min={0}
            max={maxQuantity}
            step="0.0001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label>
          Sale price per unit (optional)
          <input
            type="number"
            min={0}
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Simulating…' : 'Simulate'}
        </button>
      </form>
      {error ? <p className="error-banner">{error}</p> : null}
      {result ? (
        <div className="kpi-grid">
          <p>
            Gain/loss: <strong>{formatMoney(result.gainLoss, result.currency)}</strong>
          </p>
          <p>
            Proceeds: {formatMoney(result.proceeds, result.currency)} · Cost:{' '}
            {formatMoney(result.cost, result.currency)}
          </p>
          <p className="muted">{result.message}</p>
          {result.pit38TaxableAfterLosses != null ? (
            <p>
              PIT-38 taxable after losses:{' '}
              {formatMoney(result.pit38TaxableAfterLosses, result.currency)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
