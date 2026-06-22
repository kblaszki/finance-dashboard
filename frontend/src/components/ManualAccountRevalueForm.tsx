import { useState } from 'react'
import { revalueAccount } from '../api/accountsApi'

type Props = {
  accountId: number
  currentValue: number
  currency: string
  onSaved?: () => void
}

export function ManualAccountRevalueForm({ accountId, currentValue, currency, onSaved }: Props) {
  const [value, setValue] = useState(String(currentValue))
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid estimated value')
      return
    }
    setError(null)
    setSuccess(false)
    try {
      await revalueAccount(accountId, {
        value: parsed,
        valuationDate: new Date(valuationDate).toISOString(),
      })
      setSuccess(true)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update value')
    }
  }

  return (
    <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
      <input
        type="number"
        step="any"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Estimated value (${currency})`}
        required
      />
      <input type="date" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} required />
      <button type="submit" className="btn-primary">Update estimate</button>
      {error && <p className="error-banner">{error}</p>}
      {success && <p className="muted">Estimate saved — chart will refresh.</p>}
    </form>
  )
}
