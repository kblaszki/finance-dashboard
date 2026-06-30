import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HoldingSummary } from '../api/holdingsApi'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  currency: string
  open: HoldingSummary[]
  closed: HoldingSummary[]
}

type TypeFilter = 'ALL' | 'STOCK' | 'ETF' | 'BOND' | 'FUND' | 'OTHER'

const FILTER_OPTIONS: Array<{ id: TypeFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'STOCK', label: 'Stocks' },
  { id: 'ETF', label: 'ETFs' },
  { id: 'BOND', label: 'Bonds' },
  { id: 'FUND', label: 'Funds' },
  { id: 'OTHER', label: 'Other' },
]

function instrumentLabel(h: HoldingSummary): string {
  const { symbol, name } = h.instrument
  return name ? `${symbol} — ${name}` : symbol
}

function matchesFilter(holding: HoldingSummary, filter: TypeFilter): boolean {
  if (filter === 'ALL') return true
  const type = holding.instrument.instrumentType.toUpperCase()
  if (filter === 'OTHER') {
    return !['STOCK', 'ETF', 'BOND', 'FUND'].includes(type)
  }
  return type === filter
}

function HoldingRow({
  accountId,
  currency,
  holding,
  mode,
}: {
  accountId: number
  currency: string
  holding: HoldingSummary
  mode: 'open' | 'closed'
}) {
  const detailPath = `/accounts/${accountId}/assets/${holding.instrumentId}`

  return (
    <tr>
      <td>
        <Link to={detailPath}>{instrumentLabel(holding)}</Link>
      </td>
      <td>{holding.instrument.instrumentType}</td>
      {mode === 'open' ? (
        <>
          <td>{holding.quantity}</td>
          <td>
            {holding.marketValue != null
              ? formatMoney(holding.marketValue, currency)
              : '—'}
          </td>
        </>
      ) : (
        <>
          <td>
            {holding.realizedPnl != null
              ? formatMoney(holding.realizedPnl, currency)
              : '—'}
          </td>
          <td>
            {holding.lastTradeDate
              ? new Date(holding.lastTradeDate).toLocaleDateString('en-US')
              : '—'}
          </td>
        </>
      )}
    </tr>
  )
}

export function AccountHoldingsTable({ accountId, currency, open, closed }: Props) {
  const [filter, setFilter] = useState<TypeFilter>('ALL')

  const filteredOpen = useMemo(
    () => open.filter((h) => matchesFilter(h, filter)),
    [open, filter],
  )
  const filteredClosed = useMemo(
    () => closed.filter((h) => matchesFilter(h, filter)),
    [closed, filter],
  )

  return (
    <div>
      <div className="inline-form form-section-gap holdings-type-filter">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={filter === opt.id ? 'btn-primary' : 'btn-link'}
            onClick={() => setFilter(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <section className="form-section-gap">
        <h3>Open positions</h3>
        {filteredOpen.length === 0 ? (
          <p className="muted">No open positions match this filter.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Market value</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpen.map((h) => (
                  <HoldingRow
                    key={h.id}
                    accountId={accountId}
                    currency={currency}
                    holding={h}
                    mode="open"
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3>Closed positions</h3>
        {filteredClosed.length === 0 ? (
          <p className="muted">No closed positions match this filter.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th>Realized P&amp;L</th>
                  <th>Last trade</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosed.map((h) => (
                  <HoldingRow
                    key={h.id}
                    accountId={accountId}
                    currency={currency}
                    holding={h}
                    mode="closed"
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
