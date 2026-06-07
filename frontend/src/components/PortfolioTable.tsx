import { useEffect, useState } from 'react'
import type { PortfolioPosition, PortfolioPositionInput } from '../api/portfolioApi'
import {
  createPortfolioPosition,
  fetchPortfolio,
  refreshPortfolioMarketData,
} from '../api/portfolioApi'
import { SUPPORTED_CURRENCIES, useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'
import { Link, useNavigate } from 'react-router-dom'
import { createPortfolio, fetchPortfolios, type InvestmentPortfolio } from '../api/portfoliosApi'
import { useActivePortfolio } from '../state/portfolio'

const emptyForm: PortfolioPositionInput = {
  portfolioId: 0,
  side: 'BUY',
  symbol: '',
  quantity: 0,
  tradePrice: 0,
  tradeDate: new Date().toISOString().slice(0, 10),
  currency: 'PLN',
  category: 'UNSPECIFIED',
}

export function PortfolioTable() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PortfolioPositionInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [refreshingMarket, setRefreshingMarket] = useState(false)
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null)
  const [portfolios, setPortfolios] = useState<InvestmentPortfolio[]>([])
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('PLN')
  const { currency: displayCurrency } = useCurrency()
  const { activePortfolioId, setActivePortfolioId } = useActivePortfolio()
  const navigate = useNavigate()

  useEffect(() => {
    void loadPortfolios()
  }, [])

  useEffect(() => {
    if (activePortfolioId) void load()
  }, [displayCurrency, activePortfolioId])

  useEffect(() => {
    const selected = portfolios.find((p) => p.id === activePortfolioId)
    if (selected) {
      setForm((prev) => ({ ...prev, currency: selected.baseCurrency, portfolioId: selected.id }))
    }
  }, [portfolios, activePortfolioId])

  async function loadPortfolios() {
    const rows = await fetchPortfolios()
    setPortfolios(rows)
    if (!activePortfolioId && rows.length) setActivePortfolioId(rows[0].id)
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      if (!activePortfolioId) return
      const data = await fetchPortfolio({ currency: displayCurrency, portfolioId: activePortfolioId })
      setPositions(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activePortfolioId) {
      setError('Wybierz portfel')
      return
    }
    if (!form.symbol.trim() || form.quantity <= 0 || form.tradePrice <= 0 || !form.tradeDate) {
      setError('Typ, symbol, ilość, data i cena transakcji muszą być poprawne')
      return
    }
    setError(null)
    try {
      await createPortfolioPosition({
        ...form,
        portfolioId: activePortfolioId,
        symbol: form.symbol.trim().toUpperCase(),
        category: form.category?.trim() || 'UNSPECIFIED',
      })
      setForm({ ...emptyForm, portfolioId: activePortfolioId })
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

  async function handleCreatePortfolio(e: React.FormEvent) {
    e.preventDefault()
    if (!newPortfolioName.trim()) return
    const created = await createPortfolio({ name: newPortfolioName.trim(), baseCurrency: newPortfolioCurrency })
    await loadPortfolios()
    setActivePortfolioId(created.id)
    setForm((prev) => ({ ...prev, currency: created.baseCurrency, portfolioId: created.id }))
    setNewPortfolioName('')
  }

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null

  return (
    <div className="card">
      <form className="form-grid" onSubmit={handleCreatePortfolio}>
        <label>
          Aktywny portfel
          <select value={activePortfolioId ?? ''} onChange={(e) => setActivePortfolioId(Number(e.target.value))}>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.baseCurrency})</option>
            ))}
          </select>
        </label>
        <label>
          Saldo gotówki
          <input value={activePortfolio ? formatMoney(activePortfolio.cashBalance, activePortfolio.baseCurrency) : '—'} readOnly />
        </label>
        <label>
          Nowy portfel
          <input value={newPortfolioName} onChange={(e) => setNewPortfolioName(e.target.value)} placeholder="np. XTB" />
        </label>
        <label>
          Waluta portfela
          <select value={newPortfolioCurrency} onChange={(e) => setNewPortfolioCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-secondary">Dodaj portfel</button>
        </div>
      </form>
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h2>Portfel inwestycyjny</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activePortfolioId ? (
            <Link
              to={`/accounts/${activePortfolioId}`}
              className="btn-secondary"
            >
              Szczegóły konta
            </Link>
          ) : null}
          <button type="button" className="btn-secondary" onClick={handleRefreshMarketData} disabled={refreshingMarket}>
            {refreshingMarket ? 'Odświeżanie...' : 'Odśwież wyceny EOD'}
          </button>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Typ transakcji
          <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as 'BUY' | 'SELL' })}>
            <option value="BUY">Zakup</option>
            <option value="SELL">Sprzedaż</option>
          </select>
        </label>
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
          Cena transakcji
          <input
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.tradePrice || ''}
            onChange={(e) => setForm({ ...form, tradePrice: Number(e.target.value) })}
          />
        </label>
        <label>
          Data transakcji
          <input
            type="date"
            required
            value={form.tradeDate}
            onChange={(e) => setForm({ ...form, tradeDate: e.target.value })}
          />
        </label>
        <label>
          Waluta
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {(activePortfolio ? [activePortfolio.baseCurrency] : SUPPORTED_CURRENCIES).map((c) => (
              <option key={c} value={c}>{c}</option>
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
                <th>Transakcje</th>
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
                  <td>{p.lotsCount && p.lotsCount > 0 ? `${p.lotsCount} trade` : '—'}</td>
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
                      onClick={() => navigate(`/accounts/${activePortfolioId}`)}
                    >
                      Analizuj
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
