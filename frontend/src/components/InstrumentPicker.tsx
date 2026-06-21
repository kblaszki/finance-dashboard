import { useEffect, useState } from 'react'
import {
  createInstrument,
  fetchInstruments,
  type Instrument,
} from '../api/instrumentsApi'
import { SUPPORTED_CURRENCIES } from '../state/currency'

const INSTRUMENT_TYPES = ['STOCK', 'ETF', 'BOND', 'FUND', 'OTHER'] as const
const EXCHANGES = ['', 'GPW', 'NASDAQ', 'NYSE', 'XETRA', 'LSE', 'EURONEXT'] as const

type Props = {
  value: number | null
  onChange: (instrumentId: number) => void
}

export function InstrumentPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [instrumentType, setInstrumentType] = useState<(typeof INSTRUMENT_TYPES)[number]>('STOCK')
  const [currency, setCurrency] = useState('USD')
  const [exchange, setExchange] = useState<(typeof EXCHANGES)[number]>('')
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
        instrumentType,
        symbol: symbol.trim().toUpperCase(),
        name: name.trim() || undefined,
        currency,
        exchange: exchange || undefined,
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
            {i.symbol} {i.exchange ? `(${i.exchange})` : ''} {i.name ? `— ${i.name}` : ''}
          </option>
        ))}
      </select>
      <input placeholder="New symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
      <input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={instrumentType} onChange={(e) => setInstrumentType(e.target.value as typeof instrumentType)}>
        {INSTRUMENT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={exchange} onChange={(e) => setExchange(e.target.value as typeof exchange)}>
        {EXCHANGES.map((ex) => (
          <option key={ex || 'none'} value={ex}>{ex || 'No exchange'}</option>
        ))}
      </select>
      <button type="button" className="btn-primary" onClick={() => void handleCreate()} disabled={!symbol.trim()}>
        Add instrument
      </button>
      {searchError && <p className="error-banner">{searchError}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  )
}
