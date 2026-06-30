import { useState } from 'react'
import { updateAccount } from '../api/accountsApi'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  metalGrams: number | null
  currency: string
  estimatedValue: number
  onSaved: () => void
}

export function PreciousMetalGramsForm({
  accountId,
  metalGrams,
  currency,
  estimatedValue,
  onSaved,
}: Props) {
  const [grams, setGrams] = useState(metalGrams != null ? String(metalGrams) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const gramsNum = grams ? Number(grams) : null
  const perGram =
    gramsNum != null && gramsNum > 0 && estimatedValue > 0 ? estimatedValue / gramsNum : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateAccount(accountId, {
        metalGrams: grams ? Number(grams) : null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Metal holding (FR-032)</h2>
      <p className="muted">
        Track quantity in grams; use revalue above for total estimated value.
        {perGram != null ? ` Implied ${formatMoney(perGram, currency)}/g.` : ''}
      </p>
      {error && <p className="error-banner">{error}</p>}
      <form className="inline-form" onSubmit={(e) => void handleSave(e)}>
        <input
          type="number"
          step="0.001"
          min="0"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          placeholder="Grams"
        />
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save grams'}
        </button>
      </form>
    </section>
  )
}
