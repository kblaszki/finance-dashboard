import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchNetWorth } from '../api/statsApi'
import { useCurrency } from '../state/currency'
import { useActivePortfolio } from '../state/portfolio'
import { formatMoney } from '../utils/format'

export function AllPortfoliosTable() {
  const [rows, setRows] = useState<
    Array<{ portfolioId: number; name: string; cash: number; securities: number; total: number }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { currency } = useCurrency()
  const { setActivePortfolioId } = useActivePortfolio()

  useEffect(() => {
    void load()
  }, [currency])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNetWorth(currency)
      setRows(data.portfolios)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  const total = rows.reduce((acc, r) => acc + r.total, 0)

  return (
    <div className="card">
      <h2>Wszystkie konta maklerskie</h2>
      {error && <p className="auth-error">{error}</p>}
      {loading ? (
        <p className="loading-state">Ładowanie…</p>
      ) : !rows.length ? (
        <p className="empty-state">Brak portfeli. Dodaj konto na stronie Portfel.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Gotówka</th>
                  <th>Papiery</th>
                  <th>Razem</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.portfolioId}>
                    <td>{r.name}</td>
                    <td>{formatMoney(r.cash, currency)}</td>
                    <td>{formatMoney(r.securities, currency)}</td>
                    <td>{formatMoney(r.total, currency)}</td>
                    <td>
                      <Link
                        to={`/accounts/${r.portfolioId}`}
                        onClick={() => setActivePortfolioId(r.portfolioId)}
                      >
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Suma</th>
                  <th colSpan={2}></th>
                  <th>{formatMoney(total, currency)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
