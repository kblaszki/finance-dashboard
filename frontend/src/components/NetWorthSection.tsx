import { useEffect, useState } from 'react'
import { fetchNetWorth, type NetWorthStats } from '../api/statsApi'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

export function NetWorthSection() {
  const [stats, setStats] = useState<NetWorthStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { currency } = useCurrency()

  useEffect(() => {
    void load()
  }, [currency])

  async function load() {
    setError(null)
    try {
      setStats(await fetchNetWorth(currency))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load net worth')
      setStats(null)
    }
  }

  if (error) {
    return (
      <section className="card">
        <h2>Net worth</h2>
        <p className="auth-error">{error}</p>
      </section>
    )
  }

  if (!stats) {
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
