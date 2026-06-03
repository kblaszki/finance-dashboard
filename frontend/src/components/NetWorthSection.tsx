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
      setError(e instanceof Error ? e.message : 'Błąd ładowania wartości netto')
      setStats(null)
    }
  }

  if (error) {
    return (
      <section className="card">
        <h2>Majątek (wartość netto)</h2>
        <p className="auth-error">{error}</p>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className="card">
        <h2>Majątek (wartość netto)</h2>
        <p className="loading-state">Ładowanie…</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Majątek (wartość netto)</h2>
      <p className="kpi-highlight">{formatMoney(stats.netWorth, currency)}</p>
      <div className="kpi-grid" style={{ marginTop: '1rem' }}>
        <div className="kpi-card">
          <h3>Makler — papiery</h3>
          <p>{formatMoney(stats.brokerSecurities, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Makler — gotówka</h3>
          <p>{formatMoney(stats.brokerCash, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Konta bankowe</h3>
          <p>{formatMoney(stats.bankCash, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Nieruchomości / krypto</h3>
          <p>{formatMoney(stats.manualAssets, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Obligacje</h3>
          <p>{formatMoney(stats.bonds, currency)}</p>
        </div>
        <div className="kpi-card">
          <h3>Zobowiązania</h3>
          <p>−{formatMoney(stats.liabilities, currency)}</p>
        </div>
      </div>
      {stats.accounts.length > 0 && (
        <div className="table-wrap" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Konto</th>
                <th>Typ</th>
                <th>Wartość</th>
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
