import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { PortfolioPositionInput, PortfolioTrade } from '../api/portfolioApi'
import {
  deletePortfolioTrade,
  fetchPortfolioTrades,
  updatePortfolioTrade,
} from '../api/portfolioApi'
import { fetchPortfolios, type InvestmentPortfolio } from '../api/portfoliosApi'
import { useActivePortfolio } from '../state/portfolio'
import { formatMoney } from '../utils/format'

type TradeForm = {
  side: 'BUY' | 'SELL'
  symbol: string
  quantity: number
  tradePrice: number
  tradeDate: string
  currency: string
  category: string
}

function tradeToForm(t: PortfolioTrade): TradeForm {
  return {
    side: t.side,
    symbol: t.symbol,
    quantity: t.quantity,
    tradePrice: t.tradePrice,
    tradeDate: t.tradeDate.slice(0, 10),
    currency: t.currency,
    category: t.category,
  }
}

export function PortfolioTradesTable(props: { fixedPortfolioId?: number }) {
  const [trades, setTrades] = useState<PortfolioTrade[]>([])
  const [portfolios, setPortfolios] = useState<InvestmentPortfolio[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<TradeForm | null>(null)
  const [params] = useSearchParams()
  const { activePortfolioId, setActivePortfolioId } = useActivePortfolio()
  const portfolioId =
    props.fixedPortfolioId ?? (Number(params.get('portfolioId')) || activePortfolioId)

  const activePortfolio = portfolios.find((p) => p.id === portfolioId) ?? null

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
      const rows = await fetchPortfolios()
      setPortfolios(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(t: PortfolioTrade) {
    setEditingId(t.id)
    setEditForm(tradeToForm(t))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (editingId == null || !editForm || !portfolioId) return
    if (editForm.quantity <= 0 || editForm.tradePrice <= 0 || !editForm.symbol.trim()) {
      setError('Symbol, ilość i cena muszą być poprawne')
      return
    }
    setError(null)
    try {
      const input: Partial<PortfolioPositionInput> = {
        portfolioId,
        side: editForm.side,
        symbol: editForm.symbol.trim().toUpperCase(),
        quantity: editForm.quantity,
        tradePrice: editForm.tradePrice,
        tradeDate: editForm.tradeDate,
        currency: editForm.currency,
        category: editForm.category.trim() || 'UNSPECIFIED',
      }
      await updatePortfolioTrade(editingId, input)
      cancelEdit()
      await load(portfolioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Usunąć tę transakcję? Saldo gotówki portfela zostanie przeliczone.')) return
    if (!portfolioId) return
    setError(null)
    try {
      await deletePortfolioTrade(id)
      if (editingId === id) cancelEdit()
      await load(portfolioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć')
    }
  }

  return (
    <div className="card">
      {!props.fixedPortfolioId && (
        <>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <h2>Transakcje papierów wartościowych</h2>
            {portfolioId ? (
              <Link to="/accounts" className="btn-secondary">
                Konta maklerskie
              </Link>
            ) : null}
          </div>
          <label>
            Portfel
            <select
              value={portfolioId || ''}
              onChange={(e) => setActivePortfolioId(Number(e.target.value))}
            >
              <option value="">Wybierz…</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.baseCurrency})
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {activePortfolio && (
        <p className="loading-state">
          Saldo gotówki: {formatMoney(activePortfolio.cashBalance, activePortfolio.baseCurrency)}
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}
      {loading ? (
        <p className="loading-state">Ładowanie…</p>
      ) : !portfolioId ? (
        <p className="empty-state">Wybierz portfel.</p>
      ) : !trades.length ? (
        <p className="empty-state">
          Brak transakcji.{' '}
          <Link to={portfolioId ? `/accounts/${portfolioId}` : '/accounts'}>
            Dodaj pierwszą transakcję na stronie konta
          </Link>
          .
        </p>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) =>
                editingId === t.id && editForm ? (
                  <tr key={t.id}>
                    <td colSpan={8}>
                      <form className="form-grid" onSubmit={saveEdit}>
                        <label>
                          Data
                          <input
                            type="date"
                            required
                            value={editForm.tradeDate}
                            onChange={(e) => setEditForm({ ...editForm, tradeDate: e.target.value })}
                          />
                        </label>
                        <label>
                          Strona
                          <select
                            value={editForm.side}
                            onChange={(e) =>
                              setEditForm({ ...editForm, side: e.target.value as 'BUY' | 'SELL' })
                            }
                          >
                            <option value="BUY">BUY</option>
                            <option value="SELL">SELL</option>
                          </select>
                        </label>
                        <label>
                          Symbol
                          <input
                            required
                            value={editForm.symbol}
                            onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })}
                          />
                        </label>
                        <label>
                          Ilość
                          <input
                            type="number"
                            min={0.0001}
                            step="any"
                            required
                            value={editForm.quantity || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, quantity: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Cena
                          <input
                            type="number"
                            min={0.01}
                            step="0.01"
                            required
                            value={editForm.tradePrice || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, tradePrice: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Waluta
                          <input
                            value={editForm.currency}
                            readOnly
                            title="Waluta musi odpowiadać walucie portfela"
                          />
                        </label>
                        <label>
                          Kategoria
                          <input
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          />
                        </label>
                        <div className="form-actions form-full-width">
                          <button type="submit" className="btn-primary">
                            Zapisz
                          </button>
                          <button type="button" onClick={cancelEdit}>
                            Anuluj
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{new Date(t.tradeDate).toLocaleDateString()}</td>
                    <td>{t.side}</td>
                    <td>{t.symbol}</td>
                    <td>{t.quantity}</td>
                    <td>{formatMoney(t.tradePrice, t.currency)}</td>
                    <td>{formatMoney(t.quantity * t.tradePrice, t.currency)}</td>
                    <td>{t.category}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => startEdit(t)}>
                        Edytuj
                      </button>{' '}
                      <button type="button" onClick={() => void handleDelete(t.id)}>
                        Usuń
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
