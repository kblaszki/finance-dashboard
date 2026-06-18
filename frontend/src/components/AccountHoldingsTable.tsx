import { Link } from 'react-router-dom'
import type { HoldingSummary } from '../api/holdingsApi'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  currency: string
  open: HoldingSummary[]
  closed: HoldingSummary[]
}

function instrumentLabel(h: HoldingSummary): string {
  const { symbol, name } = h.instrument
  return name ? `${symbol} — ${name}` : symbol
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
  const detailPath = `/accounts/${accountId}/holdings/${holding.id}`

  return (
    <tr>
      <td>
        <Link to={detailPath}>{instrumentLabel(holding)}</Link>
      </td>
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
  return (
    <div>
      <section className="form-section-gap">
        <h3>Open positions</h3>
        {open.length === 0 ? (
          <p className="muted">No open positions.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Qty</th>
                  <th>Market value</th>
                </tr>
              </thead>
              <tbody>
                {open.map((h) => (
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
        {closed.length === 0 ? (
          <p className="muted">No closed positions.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Realized P&amp;L</th>
                  <th>Last trade</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((h) => (
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
