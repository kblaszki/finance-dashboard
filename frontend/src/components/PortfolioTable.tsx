import { useEffect, useState } from 'react'
import type { PortfolioPosition } from '../api/portfolioApi'
import { fetchPortfolio } from '../api/portfolioApi'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

export function PortfolioTable() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(false)
  const { currency: displayCurrency } = useCurrency()

  useEffect(() => {
    void load()
  }, [displayCurrency])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchPortfolio({ currency: displayCurrency })
      setPositions(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      {loading ? (
        <p className="loading-state">Ładowanie...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Ilość</th>
                <th>Cena zakupu</th>
                <th>Aktualna cena</th>
                <th>Waluta</th>
                <th>Wartość (wybrana)</th>
                <th>Kategoria</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td>{p.symbol}</td>
                  <td>{p.quantity}</td>
                  <td>{formatMoney(p.buyPrice, p.currency)}</td>
                  <td>{formatMoney(p.currentPrice, p.currency)}</td>
                  <td>{p.currency}</td>
                  <td>
                    {p.positionValueConverted != null && p.convertedCurrency
                      ? formatMoney(p.positionValueConverted, p.convertedCurrency)
                      : '—'}
                  </td>
                  <td>{p.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

