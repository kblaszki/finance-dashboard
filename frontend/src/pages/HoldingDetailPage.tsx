import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAccount } from '../api/accountsApi'
import { fetchHolding, type HoldingSummary } from '../api/holdingsApi'
import { fetchHoldingValuations } from '../api/valuationsApi'
import { HoldingLotsTable } from '../components/HoldingLotsTable'
import { HoldingValuationChart } from '../components/HoldingValuationChart'
import { formatMoney } from '../utils/format'

export function HoldingDetailPage() {
  const { id, holdingId: holdingIdParam } = useParams()
  const accountId = Number(id)
  const holdingId = Number(holdingIdParam)
  const [holding, setHolding] = useState<HoldingSummary | null>(null)
  const [accountCurrency, setAccountCurrency] = useState<string>('PLN')
  const [positionHistory, setPositionHistory] = useState<Awaited<ReturnType<typeof fetchHoldingValuations>>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!holdingId) return
    void loadHolding()
  }, [holdingId])

  useEffect(() => {
    if (!accountId || !holding?.instrumentId) {
      setPositionHistory([])
      return
    }
    void fetchHoldingValuations(accountId, holding.instrumentId)
      .then(setPositionHistory)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load position history'))
  }, [accountId, holding?.instrumentId])

  async function loadHolding() {
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
  }

  if (!holding) {
    return (
      <div className="page">
        <p className="muted">{error ?? 'Loading…'}</p>
        <Link to={`/accounts/${accountId}`} className="page-back-link">← Account</Link>
      </div>
    )
  }

  const { symbol, name } = holding.instrument
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
        <h2>Trade history</h2>
        <HoldingLotsTable
          holdingId={holdingId}
          currency={accountCurrency}
          onLotsChange={loadHolding}
        />
      </section>
    </div>
  )
}
