import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchPortfolioTrades, type PortfolioTrade } from '../api/portfolioApi'
import { fetchPortfolios, type InvestmentPortfolio } from '../api/portfoliosApi'
import { useActivePortfolio } from '../state/portfolio'
import { formatMoney } from '../utils/format'

export function PortfolioTradesTable() {
  const [trades, setTrades] = useState<PortfolioTrade[]>([])
  const [portfolios, setPortfolios] = useState<InvestmentPortfolio[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()
  const { activePortfolioId, setActivePortfolioId } = useActivePortfolio()
  const portfolioId = Number(params.get('portfolioId')) || activePortfolioId

  useEffect(() => {
    void fetchPortfolios().then(setPortfolios)
  }, [])

  useEffect(() => {
    if (params.get('portfolioId')) {
      setActivePortfolioId(Number(params.get('portfolioId')))
    }
  }, [params])

  useEffect(() => {
    if (portfolioId) void load(portfolioId)
  }, [portfolioId])

  async function load(pid: number) {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPortfolioTrades({ portfolioId: pid })
      setTrades(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Transakcje papierów wartościowych</h2>
      <label>
        Portfel
        <select
          value={portfolioId || ''}
          onChange={(e) => setActivePortfolioId(Number(e.target.value))}
        >
          <option value="">Wybierz…</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="auth-error">{error}</p>}
      {loading ? (
        <p className="loading-state">Ładowanie…</p>
      ) : !portfolioId ? (
        <p className="empty-state">Wybierz portfel.</p>
      ) : !trades.length ? (
        <p className="empty-state">Brak transakcji.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Strona</th>
                <th>Symbol</th>
                <th>Ilość</th>
                <th>Cena</th>
                <th>Wartość</th>
                <th>Kategoria</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.tradeDate).toLocaleDateString()}</td>
                  <td>{t.side}</td>
                  <td>{t.symbol}</td>
                  <td>{t.quantity}</td>
                  <td>{formatMoney(t.tradePrice, t.currency)}</td>
                  <td>{formatMoney(t.quantity * t.tradePrice, t.currency)}</td>
                  <td>{t.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
