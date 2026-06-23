import { useState } from 'react'
import { applyStockSplit } from '../api/holdingsApi'

type Props = {
  holdingId: number
  onApplied: () => void
}

export function HoldingSplitForm({ holdingId, onApplied }: Props) {
  const [ratio, setRatio] = useState('4')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedRatio = Number(ratio)
    if (!Number.isFinite(parsedRatio) || parsedRatio <= 0) {
      setError('Ratio must be a positive number')
      return
    }
    if (
      !confirm(
        `Apply ${parsedRatio}:1 split? Share quantity will multiply by ${parsedRatio}; cost per share will divide accordingly.`,
      )
    ) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await applyStockSplit(holdingId, {
        ratio: parsedRatio,
        effectiveDate: new Date(effectiveDate).toISOString(),
      })
      onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply split')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
      <label>
        Ratio
        <input
          type="number"
          step="any"
          min="0"
          value={ratio}
          onChange={(e) => setRatio(e.target.value)}
          placeholder="4"
          required
        />
      </label>
      <label>
        Effective date
        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
      </label>
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Applying…' : 'Apply split'}
      </button>
      {error && <p className="error-banner">{error}</p>}
      <p className="muted">
        Historical cost basis per share is divided by the ratio; total cost per lot stays the same.
      </p>
    </form>
  )
}
