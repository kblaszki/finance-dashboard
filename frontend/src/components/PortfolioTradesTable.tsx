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
      setError(e instanceof Error ? e.message : 'Failed to load')
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
      setError('Symbol, quantity, and price must be valid')
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
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this trade? Portfolio cash balance will be recalculated.')) return
    if (!portfolioId) return
    setError(null)
    try {
      await deletePortfolioTrade(id)
      if (editingId === id) cancelEdit()
      await load(portfolioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="card">
      {!props.fixedPortfolioId && (
        <>
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <h2>Securities trades</h2>
            {portfolioId ? (
              <Link to="/accounts" className="btn-secondary">
                Brokerage accounts
              </Link>
            ) : null}
          </div>
          <label>
            Brokerage account
            <select
              value={portfolioId || ''}
              onChange={(e) => setActivePortfolioId(Number(e.target.value))}
            >
              <option value="">Select…</option>
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
          Cash balance: {formatMoney(activePortfolio.cashBalance, activePortfolio.baseCurrency)}
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}
      {loading ? (
        <p className="loading-state">Loading…</p>
      ) : !portfolioId ? (
        <p className="empty-state">Select a brokerage account.</p>
      ) : !trades.length ? (
        <p className="empty-state">
          No trades.{' '}
          <Link to={portfolioId ? `/accounts/${portfolioId}` : '/accounts'}>
            Add the first trade on the account page
          </Link>
          .
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Side</th>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Value</th>
                <th>Category</th>
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
                          Date
                          <input
                            type="date"
                            required
                            value={editForm.tradeDate}
                            onChange={(e) => setEditForm({ ...editForm, tradeDate: e.target.value })}
                          />
                        </label>
                        <label>
                          Side
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
                          Quantity
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
                          Price
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
                          Currency
                          <input
                            value={editForm.currency}
                            readOnly
                            title="Currency must match the brokerage account"
                          />
                        </label>
                        <label>
                          Category
                          <input
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          />
                        </label>
                        <div className="form-actions form-full-width">
                          <button type="submit" className="btn-primary">
                            Save
                          </button>
                          <button type="button" onClick={cancelEdit}>
                            Cancel
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
                        Edit
                      </button>{' '}
                      <button type="button" onClick={() => void handleDelete(t.id)}>
                        Delete
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
