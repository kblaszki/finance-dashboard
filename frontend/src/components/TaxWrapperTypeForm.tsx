import { useState } from 'react'
import { updateAccount, type TaxWrapperType } from '../api/accountsApi'

const WRAPPER_TYPES: TaxWrapperType[] = ['standard', 'ike', 'ikze', 'ppk']

type Props = {
  accountId: number
  taxWrapperType: TaxWrapperType
  onSaved: () => void
}

export function TaxWrapperTypeForm({ accountId, taxWrapperType, onSaved }: Props) {
  const [value, setValue] = useState<TaxWrapperType>(taxWrapperType)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateAccount(accountId, { taxWrapperType: value })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Tax wrapper (FR-039)</h2>
      <p className="muted">
        IKE/IKZE/PPK accounts are excluded from PIT-38 unless a qualifying withdrawal is recorded
        for the tax year.
      </p>
      <form onSubmit={handleSave} className="form-grid">
        <label>
          Wrapper type
          <select value={value} onChange={(e) => setValue(e.target.value as TaxWrapperType)}>
            {WRAPPER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save wrapper type'}
        </button>
      </form>
    </section>
  )
}
