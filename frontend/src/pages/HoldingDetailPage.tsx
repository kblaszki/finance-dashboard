import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAccount } from '../api/accountsApi'
import { fetchAccountAssetHolding, fetchHolding, type HoldingSummary } from '../api/holdingsApi'
import { fetchHoldingValuations } from '../api/valuationsApi'
import { HoldingKpiCards } from '../components/HoldingKpiCards'
import { HoldingLotsTable } from '../components/HoldingLotsTable'
import { HoldingSplitForm } from '../components/HoldingSplitForm'
import { HoldingValuationChart } from '../components/HoldingValuationChart'
import { InstrumentValuationForm } from '../components/InstrumentValuationForm'
import { useAsyncData } from '../hooks/useAsyncData'
import { rangeForPreset } from '../state/period'
import { PreSellSimulatorForm } from '../components/PreSellSimulatorForm'
import { formatMoney } from '../utils/format'

const defaultChartRange = rangeForPreset('last_12_months')

type HoldingDetailData = {
  holding: HoldingSummary
  accountCurrency: string
  positionHistory: Awaited<ReturnType<typeof fetchHoldingValuations>>
}

export function HoldingDetailPage() {
  const { id, holdingId: holdingIdParam, instrumentId: instrumentIdParam } = useParams()
  const accountId = Number(id)
  const holdingId = holdingIdParam != null ? Number(holdingIdParam) : NaN
  const instrumentId = instrumentIdParam != null ? Number(instrumentIdParam) : NaN
  const useInstrumentRoute = instrumentIdParam != null
  const invalidAccountId = !Number.isFinite(accountId) || accountId < 1
  const invalidHoldingId =
    !useInstrumentRoute && (!Number.isFinite(holdingId) || holdingId < 1)
  const invalidInstrumentId =
    useInstrumentRoute && (!Number.isFinite(instrumentId) || instrumentId < 1)
  const invalidId = invalidAccountId || invalidHoldingId || invalidInstrumentId
  const [chartFrom, setChartFrom] = useState(defaultChartRange.from)
  const [chartTo, setChartTo] = useState(defaultChartRange.to)
  const [historyVersion, setHistoryVersion] = useState(0)

  const loader = useCallback(async (): Promise<HoldingDetailData | null> => {
    if (invalidId) return null
    void historyVersion
    const [holding, account] = await Promise.all([
      useInstrumentRoute
        ? fetchAccountAssetHolding(accountId, instrumentId)
        : fetchHolding(holdingId),
      fetchAccount(accountId),
    ])
    const positionHistory = await fetchHoldingValuations(
      accountId,
      holding.instrumentId,
      chartFrom,
      chartTo,
    )
    return { holding, accountCurrency: account.currency, positionHistory }
  }, [invalidId, accountId, holdingId, instrumentId, useInstrumentRoute, historyVersion, chartFrom, chartTo])

  const { data, error, loading, reload } = useAsyncData(loader)

  function refreshAfterValuation() {
    reload()
    setHistoryVersion((v) => v + 1)
  }

  if (invalidId) {
    return (
      <div className="page">
        <p className="error-banner">Invalid account or holding ID</p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
        <Link to={`/accounts/${accountId}`} className="page-back-link">← Account</Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <p className="error-banner">{error ?? 'Failed to load holding'}</p>
        <Link to={`/accounts/${accountId}`} className="page-back-link">← Account</Link>
      </div>
    )
  }

  const { holding, accountCurrency, positionHistory } = data
  const { symbol, name, currency: instrumentCurrency } = holding.instrument
  const title = name ? `${symbol} — ${name}` : symbol
  const isOpen = holding.quantity > 0

  return (
    <div className="page">
      <p>
        <Link to={`/accounts/${accountId}`} className="page-back-link">← Account</Link>
      </p>
      <h1 className="page-title">{title}</h1>
      <p className="muted">
        {isOpen ? `Quantity ${holding.quantity}` : 'Closed position'}
        {isOpen && holding.marketValue != null && (
          <> · Market value {formatMoney(holding.marketValue, accountCurrency)}</>
        )}
        {!isOpen && holding.realizedPnl != null && (
          <> · Realized P&amp;L {formatMoney(holding.realizedPnl, accountCurrency)}</>
        )}
        {' · '}
        <Link to={`/assets/${holding.instrumentId}`}>Unit price chart</Link>
      </p>
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>Position summary</h2>
        <HoldingKpiCards holding={holding} currency={accountCurrency} />
      </section>

      <section className="card">
        <h2>Position value history</h2>
        <div className="inline-form form-section-gap">
          <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
          <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
        </div>
        <HoldingValuationChart points={positionHistory} currency={accountCurrency} />
      </section>

      <section className="card">
        <h2>Manual price</h2>
        <p className="muted">Use when automatic market sync has no quote for this instrument.</p>
        <InstrumentValuationForm
          instrumentId={holding.instrumentId}
          currency={instrumentCurrency}
          instrumentType={holding.instrument.instrumentType}
          onSaved={refreshAfterValuation}
        />
      </section>

      {isOpen ? (
        <PreSellSimulatorForm
          holdingId={holding.id}
          symbol={symbol}
          maxQuantity={holding.quantity}
          currency={accountCurrency}
        />
      ) : null}

      <section className="card">
        <h2>Stock split</h2>
        <HoldingSplitForm
          holdingId={holdingId}
          onApplied={() => {
            reload()
            setHistoryVersion((v) => v + 1)
          }}
        />
      </section>

      <section className="card">
        <h2>Trade history</h2>
        <HoldingLotsTable
          holdingId={holdingId}
          currency={accountCurrency}
          onLotsChange={() => {
            reload()
            setHistoryVersion((v) => v + 1)
          }}
        />
      </section>
    </div>
  )
}
