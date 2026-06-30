import { useState } from 'react'
import { updateAccount, type RentalTaxMethod } from '../api/accountsApi'

const METHODS: RentalTaxMethod[] = ['scale', 'lump_sum_8_5']

type Props = {
  accountId: number
  rentalTaxMethod: RentalTaxMethod | null
  onSaved: () => void
}

export function RentalTaxMethodForm({ accountId, rentalTaxMethod, onSaved }: Props) {
  const [value, setValue] = useState<RentalTaxMethod>(rentalTaxMethod ?? 'scale')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateAccount(accountId, { rentalTaxMethod: value })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Rental tax method (FR-044)</h2>
      <form onSubmit={(e) => void handleSave(e)} className="form-grid">
        <label>
          Method
          <select value={value} onChange={(e) => setValue(e.target.value as RentalTaxMethod)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m === 'scale' ? 'Tax scale (costs deductible)' : 'Lump sum 8.5%'}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save method'}
        </button>
      </form>
    </section>
  )
}
