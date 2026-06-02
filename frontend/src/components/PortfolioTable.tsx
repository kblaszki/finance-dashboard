import { useEffect, useState } from 'react'
import type { PortfolioPosition, PortfolioPositionInput } from '../api/portfolioApi'
import { createPortfolioPosition, fetchPortfolio } from '../api/portfolioApi'
import { SUPPORTED_CURRENCIES, useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

const emptyForm: PortfolioPositionInput = {
  symbol: '',
  quantity: 0,
  buyPrice: 0,
  currentPrice: 0,
  currency: 'PLN',
  category: 'UNSPECIFIED',
}

export function PortfolioTable() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PortfolioPositionInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const { currency: displayCurrency } = useCurrency()

  useEffect(() => {
    void load()
  }, [displayCurrency])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPortfolio({ currency: displayCurrency })
      setPositions(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.symbol.trim() || form.quantity <= 0 || form.buyPrice <= 0 || form.currentPrice <= 0) {
      setError('Symbol, ilość i ceny muszą być poprawne')
      return
    }
    setError(null)
    try {
      await createPortfolioPosition({
        ...form,
        symbol: form.symbol.trim().toUpperCase(),
        category: form.category?.trim() || 'UNSPECIFIED',
      })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać pozycji')
    }
  }

  return (
    <div className="card">
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Symbol
          <input
            required
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="np. AAPL"
          />
        </label>
        <label>
          Ilość
          <input
            type="number"
            min={0.0001}
            step="any"
            required
            value={form.quantity || ''}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </label>
        <label>
          Cena zakupu
          <input
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.buyPrice || ''}
            onChange={(e) => setForm({ ...form, buyPrice: Number(e.target.value) })}
          />
        </label>
        <label>
          Aktualna cena
          <input
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.currentPrice || ''}
            onChange={(e) => setForm({ ...form, currentPrice: Number(e.target.value) })}
          />
        </label>
        <label>
          Waluta
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kategoria
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Dodaj aktywo
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="loading-state">Ładowanie...</p>
      ) : positions.length === 0 ? (
        <p className="empty-state">Brak pozycji w portfelu.</p>
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
