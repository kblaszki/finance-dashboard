import { useState } from 'react'
import { createInstrumentValuation } from '../api/instrumentsApi'

type Props = {
  instrumentId: number
  currency: string
  instrumentType?: string
  onSaved?: () => void
}

function valuationSourceForType(instrumentType?: string): string {
  const type = (instrumentType ?? '').toUpperCase()
  if (type === 'BOND' || type === 'FUND') return 'manual_nav'
  return 'manual'
}

export function InstrumentValuationForm({ instrumentId, currency, instrumentType, onSaved }: Props) {
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().slice(0, 10))
  const [price, setPrice] = useState('')
  const [priceCurrency, setPriceCurrency] = useState(currency)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const isManualNav = valuationSourceForType(instrumentType) === 'manual_nav'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(price)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a positive price')
      return
    }
    setError(null)
    setSuccess(false)
    try {
      await createInstrumentValuation(instrumentId, {
        valuationDate: new Date(valuationDate).toISOString(),
        price: parsed,
        currency: priceCurrency,
        source: valuationSourceForType(instrumentType),
      })
      setSuccess(true)
      setPrice('')
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save valuation')
    }
  }

  return (
    <div>
      {isManualNav && (
        <p className="muted">
          Bonds and funds use manual NAV — enter the latest price or unit value from your broker or fund manager.
        </p>
      )}
      <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <input type="date" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} required />
        <input
          type="number"
          step="any"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price per unit"
          required
        />
        <input
          value={priceCurrency}
          onChange={(e) => setPriceCurrency(e.target.value.toUpperCase())}
          placeholder="Currency"
          maxLength={3}
          required
        />
        <button type="submit" className="btn-primary">Add price</button>
        {error && <p className="error-banner">{error}</p>}
        {success && <p className="muted">Valuation saved — charts will refresh.</p>}
      </form>
    </div>
  )
}
