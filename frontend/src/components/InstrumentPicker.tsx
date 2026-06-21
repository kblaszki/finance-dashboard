import { useEffect, useState } from 'react'
import { createInstrument, fetchInstruments, type Instrument } from '../api/instrumentsApi'

type Props = {
  value: number | null
  onChange: (instrumentId: number) => void
}

export function InstrumentPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSearchError(null)
    void fetchInstruments(query || undefined)
      .then((rows) => {
        if (active) setInstruments(rows)
      })
      .catch((e) => {
        if (!active) return
        setInstruments([])
        setSearchError(e instanceof Error ? e.message : 'Failed to search instruments')
      })
    return () => {
      active = false
    }
  }, [query])

  async function handleCreate() {
    setError(null)
    try {
      const row = await createInstrument({
        instrumentType: 'STOCK',
        symbol: symbol.trim().toUpperCase(),
        name: name.trim() || undefined,
        currency: 'USD',
      })
      onChange(row.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create instrument')
    }
  }

  return (
    <div className="inline-form">
      <input
        placeholder="Search symbol"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        required
      >
        <option value="">Select instrument</option>
        {instruments.map((i) => (
          <option key={i.id} value={i.id}>
            {i.symbol} {i.name ? `— ${i.name}` : ''}
          </option>
        ))}
      </select>
      <input placeholder="New symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
      <input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <button type="button" className="btn-primary" onClick={() => void handleCreate()} disabled={!symbol.trim()}>
        Add instrument
      </button>
      {searchError && <p className="error-banner">{searchError}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  )
}
