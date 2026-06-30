import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchInstrument, fetchInstrumentValuations } from '../api/instrumentsApi'
import { InstrumentPriceChart } from '../components/InstrumentPriceChart'
import { InstrumentValuationForm } from '../components/InstrumentValuationForm'
import { useAsyncData } from '../hooks/useAsyncData'
import { rangeForPreset } from '../state/period'

const defaultChartRange = rangeForPreset('last_12_months')

export function AssetDetailPage() {
  const { id } = useParams()
  const instrumentId = Number(id)
  const invalidId = !Number.isFinite(instrumentId) || instrumentId < 1
  const [chartFrom, setChartFrom] = useState(defaultChartRange.from)
  const [chartTo, setChartTo] = useState(defaultChartRange.to)
  const [historyVersion, setHistoryVersion] = useState(0)

  const loader = useCallback(async () => {
    if (invalidId) throw new Error('Invalid instrument ID')
    void historyVersion
    const instrument = await fetchInstrument(instrumentId)
    const valuations = await fetchInstrumentValuations(instrumentId, {
      from: chartFrom,
      to: chartTo,
    })
    return { instrument, valuations }
  }, [invalidId, instrumentId, chartFrom, chartTo, historyVersion])

  const { data, error, loading, reload } = useAsyncData(loader)

  if (invalidId) {
    return (
      <div className="page">
        <p className="error-banner">Invalid instrument ID</p>
        <Link to="/portfolio" className="page-back-link">← Portfolio</Link>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
        <Link to="/portfolio" className="page-back-link">← Portfolio</Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <p className="error-banner">{error ?? 'Failed to load instrument'}</p>
        <Link to="/portfolio" className="page-back-link">← Portfolio</Link>
      </div>
    )
  }

  const { instrument, valuations } = data
  const title = instrument.name ? `${instrument.symbol} — ${instrument.name}` : instrument.symbol

  return (
    <div className="page">
      <p>
        <Link to="/portfolio" className="page-back-link">← Portfolio</Link>
      </p>
      <h1 className="page-title">{title}</h1>
      <p className="muted">
        {instrument.instrumentType}
        {instrument.exchange ? ` · ${instrument.exchange}` : ''}
        {' · '}
        {instrument.currency}
      </p>

      <section className="card">
        <h2>Price history</h2>
        <div className="inline-form form-section-gap">
          <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
          <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
        </div>
        <InstrumentPriceChart points={valuations} currency={instrument.currency} />
      </section>

      <section className="card">
        <h2>Manual price</h2>
        <p className="muted">Add a valuation when market sync has no quote for this instrument.</p>
        <InstrumentValuationForm
          instrumentId={instrument.id}
          currency={instrument.currency}
          instrumentType={instrument.instrumentType}
          onSaved={() => {
            reload()
            setHistoryVersion((v) => v + 1)
          }}
        />
      </section>
    </div>
  )
}
