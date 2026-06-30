import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { fetchNetWorth, type NetWorthBucket } from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

const BUCKET_LABELS: Record<NetWorthBucket, string> = {
  cash: 'Cash',
  stock_market: 'Stock market',
  crypto: 'Crypto',
  precious_metal_other: 'Gold & other',
  real_estate: 'Real estate',
}

export function NetWorthSection() {
  const { currency } = useCurrency()
  const loader = useCallback(() => fetchNetWorth(currency), [currency])
  const { data: stats, error, loading } = useAsyncData(loader)

  if (error) {
    return (
      <section className="card">
        <h2>Net worth</h2>
        <p className="auth-error">{error}</p>
      </section>
    )
  }

  if (loading || !stats) {
    return (
      <section className="card">
        <h2>Net worth</h2>
        <p className="loading-state">Loading…</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Net worth</h2>
      <p className="kpi-highlight">{formatMoney(stats.total, currency)}</p>
      <p className="muted">
        Assets {formatMoney(stats.totalAssets, currency)} − liabilities{' '}
        {formatMoney(stats.totalLiabilities, currency)}
        {stats.totalLiabilities > 0 && (
          <>
            {' '}
            · <Link to="/liabilities">Manage liabilities</Link>
          </>
        )}
      </p>
      <div className="kpi-grid stack-md">
        {stats.byBucket.map((row) => (
          <div className="kpi-card" key={row.bucket}>
            <h3>{BUCKET_LABELS[row.bucket]}</h3>
            <p>{formatMoney(row.value, currency)}</p>
            <p className="muted">{row.pct.toFixed(1)}%</p>
          </div>
        ))}
      </div>
      {stats.liabilities.length > 0 && (
        <details className="stack-md">
          <summary className="muted">Liabilities ({stats.liabilities.length})</summary>
          <div className="table-wrap stack-md">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {stats.liabilities.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.liabilityType}</td>
                    <td>{formatMoney(row.balance, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {stats.accounts.length > 0 && (
        <details className="stack-md">
          <summary className="muted">By account</summary>
          <div className="table-wrap stack-md">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {stats.accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.accountType}</td>
                    <td>{formatMoney(a.value, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
