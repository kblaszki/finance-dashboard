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
      const data = await fetchNetWorth(currency)
      setStats(data)
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
      <p className="kpi-highlight">{formatMoney(stats.netWorth, currency)}</p>
      <div className="kpi-grid" style={{ marginTop: '1rem' }}>
        <div className="kpi-card">
          <h3>Brokerage — securities</h3>
          <p>{formatMoney(stats.brokerSecurities, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Brokerage — cash</h3>
          <p>{formatMoney(stats.brokerCash, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Bank accounts</h3>
          <p>{formatMoney(stats.bankCash, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Real estate / crypto</h3>
          <p>{formatMoney(stats.manualAssets, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Bonds</h3>
          <p>{formatMoney(stats.bonds, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Liabilities</h3>
          <p>−{formatMoney(stats.liabilities, currency)}</p>
        </div>
      </div>
      {stats.accounts.length > 0 && (
        <div className="table-wrap" style={{ marginTop: '1rem' }}>
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
                <tr key={a.accountId}>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
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
