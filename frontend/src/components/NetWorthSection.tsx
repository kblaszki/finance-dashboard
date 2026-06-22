import { useCallback } from 'react'
import { fetchNetWorth } from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

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
      <div className="kpi-grid stack-md">
        {Object.entries(stats.byAccountType).map(([type, value]) => (
          <div className="kpi-card" key={type}>
            <h3>{type}</h3>
            <p>{formatMoney(value, currency)}</p>
          </div>
        ))}
      </div>
      {stats.accounts.length > 0 && (
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
      )}
    </section>
  )
}
