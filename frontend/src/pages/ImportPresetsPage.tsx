import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createImportPreset,
  deleteImportPreset,
  fetchImportPresets,
} from '../api/importPresetsApi'
import { useAsyncData } from '../hooks/useAsyncData'

export function ImportPresetsPage() {
  const { data, reload } = useAsyncData(fetchImportPresets)
  const [name, setName] = useState('')
  const [broker, setBroker] = useState('')
  const [targetType, setTargetType] = useState('asset_transaction')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createImportPreset({
        name,
        broker,
        targetType,
        columnMapping: {},
      })
      setName('')
      setBroker('')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Import presets</h1>
        <p className="muted">Broker CSV column mapping templates (FR-047).</p>
        <p>
          <Link to="/import">← Import</Link>
        </p>
      </header>

      <section className="card">
        <h2>Built-in presets</h2>
        <ul>
          {(data?.builtin ?? []).map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> ({p.broker}) — {p.targetType}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Custom presets</h2>
        <form className="form-grid" onSubmit={(e) => void handleCreate(e)}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Broker
            <input value={broker} onChange={(e) => setBroker(e.target.value)} required />
          </label>
          <label>
            Target
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="cash_flow">cash_flow</option>
              <option value="asset_transaction">asset_transaction</option>
              <option value="income_event">income_event</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">
            Save preset
          </button>
        </form>
        {error ? <p className="error-banner">{error}</p> : null}
        <ul>
          {(data?.custom ?? []).map((p) => (
            <li key={p.id}>
              {p.name} ({p.broker}){' '}
              <button type="button" className="btn-link" onClick={() => void deleteImportPreset(p.id).then(reload)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
