import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAccount } from '../api/accountsApi'
import { fetchHolding, type HoldingSummary } from '../api/holdingsApi'
import { fetchHoldingValuations } from '../api/valuationsApi'
import { HoldingLotsTable } from '../components/HoldingLotsTable'
import { HoldingValuationChart } from '../components/HoldingValuationChart'
import { InstrumentValuationForm } from '../components/InstrumentValuationForm'
import { formatMoney } from '../utils/format'

export function HoldingDetailPage() {
  const { id, holdingId: holdingIdParam } = useParams()
  const accountId = Number(id)
  const holdingId = Number(holdingIdParam)
  const invalidAccountId = !Number.isFinite(accountId) || accountId < 1
  const invalidHoldingId = !Number.isFinite(holdingId) || holdingId < 1
  const invalidId = invalidAccountId || invalidHoldingId
  const [holding, setHolding] = useState<HoldingSummary | null>(null)
  const [accountCurrency, setAccountCurrency] = useState<string>('PLN')
  const [positionHistory, setPositionHistory] = useState<Awaited<ReturnType<typeof fetchHoldingValuations>>>([])
  const [error, setError] = useState<string | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  const loadHolding = useCallback(async () => {
    setError(null)
    try {
      const [h, account] = await Promise.all([
        fetchHolding(holdingId),
        fetchAccount(accountId),
      ])
      setHolding(h)
      setAccountCurrency(account.currency)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load holding')
    }
  }, [accountId, holdingId])

  useEffect(() => {
    if (invalidId) return
    void loadHolding()
  }, [invalidId, loadHolding])

  useEffect(() => {
    if (invalidId || !holding?.instrumentId) {
      setPositionHistory([])
      return
    }
    void fetchHoldingValuations(accountId, holding.instrumentId)
      .then(setPositionHistory)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load position history'))
  }, [invalidId, accountId, holding?.instrumentId, historyVersion])

  function refreshAfterValuation() {
    void loadHolding()
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

  if (!holding) {
    return (
      <div className="page">
        <p className="muted">{error ?? 'Loading…'}</p>
        <Link to={`/accounts/${accountId}`} className="page-back-link">← Account</Link>
      </div>
    )
  }

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
      </p>
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>Position value history</h2>
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

      <section className="card">
        <h2>Trade history</h2>
        <HoldingLotsTable
          holdingId={holdingId}
          currency={accountCurrency}
          onLotsChange={() => {
            void loadHolding()
            setHistoryVersion((v) => v + 1)
          }}
        />
      </section>
    </div>
  )
}
