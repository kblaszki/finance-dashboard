import { useEffect, useState } from 'react'
import type { PortfolioLot, PortfolioPosition, PortfolioPositionInput } from '../api/portfolioApi'
import {
  createPortfolioPosition,
  fetchPortfolio,
  fetchPortfolioLots,
  refreshPortfolioMarketData,
  deletePortfolioPosition,
} from '../api/portfolioApi'
import { SUPPORTED_CURRENCIES, useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'
import { useNavigate } from 'react-router-dom'

const emptyForm: PortfolioPositionInput = {
  symbol: '',
  quantity: 0,
  buyPrice: 0,
  buyDate: new Date().toISOString().slice(0, 10),
  currency: 'PLN',
  category: 'UNSPECIFIED',
}

export function PortfolioTable() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [lots, setLots] = useState<PortfolioLot[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PortfolioPositionInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [refreshingMarket, setRefreshingMarket] = useState(false)
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null)
  const { currency: displayCurrency } = useCurrency()
  const navigate = useNavigate()

  useEffect(() => {
    void load()
  }, [displayCurrency])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPortfolio({ currency: displayCurrency })
      const lotsData = await fetchPortfolioLots()
      setPositions(data)
      setLots(lotsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.symbol.trim() || form.quantity <= 0 || form.buyPrice <= 0 || !form.buyDate) {
      setError('Symbol, ilość, data i cena zakupu muszą być poprawne')
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

  async function handleRefreshMarketData() {
    setRefreshingMarket(true)
    setRefreshInfo(null)
    setError(null)
    try {
      const response = await refreshPortfolioMarketData()
      setRefreshInfo(
        `Odświeżono ${response.symbolsProcessed}/${response.requested} tickerów, punkty historii: ${response.rowsInserted}${response.errors.length ? `, błędy: ${response.errors.length}` : ''}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się odświeżyć wycen')
    } finally {
      setRefreshingMarket(false)
    }
  }

  async function handleDeleteLot(id: number) {
    setError(null)
    try {
      await deletePortfolioPosition(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć lotu')
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <h2>Portfel inwestycyjny</h2>
        <button type="button" className="btn-secondary" onClick={handleRefreshMarketData} disabled={refreshingMarket}>
          {refreshingMarket ? 'Odświeżanie...' : 'Odśwież wyceny EOD'}
        </button>
      </div>

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
          Data zakupu
          <input
            type="date"
            required
            value={form.buyDate}
            onChange={(e) => setForm({ ...form, buyDate: e.target.value })}
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
      {refreshInfo && <p className="loading-state">{refreshInfo}</p>}

      {loading ? (
        <p className="loading-state">Ładowanie...</p>
      ) : positions.length === 0 ? (
        <p className="empty-state">Brak pozycji w portfelu.</p>
      ) : (
        <>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Ilość</th>
                <th>Cena zakupu</th>
                <th>Aktualna cena</th>
                <th>Waluta</th>
                <th>Koszt (wybrana)</th>
                <th>Wartość (wybrana)</th>
                <th>Zysk (wybrana)</th>
                <th>Status danych</th>
                <th>Data close</th>
                <th>Kategoria</th>
                <th>Analiza</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td>{p.symbol}</td>
                  <td>{p.quantity}</td>
                  <td>{formatMoney(p.buyPrice, p.currency)}</td>
                  <td>
                    {p.lastClose != null && p.marketDataCurrency
                      ? formatMoney(p.lastClose, p.marketDataCurrency)
                      : '—'}
                  </td>
                  <td>{p.currency}</td>
                  <td>
                    {p.positionCostConverted != null && p.convertedCurrency
                      ? formatMoney(p.positionCostConverted, p.convertedCurrency)
                      : '—'}
                  </td>
                  <td>
                    {p.positionValueConverted != null && p.convertedCurrency
                      ? formatMoney(p.positionValueConverted, p.convertedCurrency)
                      : '—'}
                  </td>
                  <td>
                    {p.profitAbs != null && p.convertedCurrency
                      ? `${formatMoney(p.profitAbs, p.convertedCurrency)} (${(p.profitPct ?? 0).toFixed(2)}%)`
                      : '—'}
                  </td>
                  <td>{p.marketDataStatus ?? 'missing'}</td>
                  <td>
                    {p.lastCloseDate ? new Date(p.lastCloseDate).toLocaleDateString() : '—'}
                  </td>
                  <td>{p.category}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate(`/portfolio/${encodeURIComponent(p.symbol)}`)}
                    >
                      Analizuj
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Loty zakupowe</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Ilość</th>
                <th>Cena zakupu</th>
                <th>Data zakupu</th>
                <th>Waluta</th>
                <th>Kategoria</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td>{l.symbol}</td>
                  <td>{l.quantity}</td>
                  <td>{formatMoney(l.buyPrice, l.currency)}</td>
                  <td>{new Date(l.buyDate).toLocaleDateString()}</td>
                  <td>{l.currency}</td>
                  <td>{l.category}</td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => handleDeleteLot(l.id)}>
                      Usuń lot
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
