import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  fetchPortfolioTrades,
  fetchPortfolioSymbolHistory,
  type PortfolioHistoryPoint,
  type PortfolioTrade,
} from '../api/portfolioApi'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useActivePortfolio } from '../state/portfolio'

export function PortfolioPositionAnalysis() {
  const params = useParams()
  const symbol = String(params.symbol ?? '').toUpperCase()
  const { currency } = useCurrency()
  const { activePortfolioId } = useActivePortfolio()
  const [method, setMethod] = useState<'weighted' | 'fifo'>('weighted')
  const [data, setData] = useState<PortfolioHistoryPoint[]>([])
  const [trades, setTrades] = useState<PortfolioTrade[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol || !activePortfolioId) return
    void load()
  }, [symbol, method, currency, activePortfolioId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      if (!activePortfolioId) return
      const rows = await fetchPortfolioSymbolHistory({ symbol, method, currency, portfolioId: activePortfolioId })
      const symbolTrades = await fetchPortfolioTrades({ symbol, portfolioId: activePortfolioId })
      setData(rows)
      setTrades(symbolTrades)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const latest = useMemo(() => (data.length ? data[data.length - 1] : null), [data])

  return (
    <div className="card">
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <h2>Position analysis: {symbol}</h2>
        <select value={method} onChange={(e) => setMethod(e.target.value as 'weighted' | 'fifo')}>
          <option value="weighted">Weighted Avg</option>
          <option value="fifo">FIFO</option>
        </select>
      </div>

      {latest && (
        <p className="loading-state">
          Latest profit: {formatMoney(latest.profitAbs, latest.currency)} ({latest.profitPct.toFixed(2)}%)
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}
      {loading ? (
        <p className="loading-state">Loading…</p>
      ) : !data.length ? (
        <p className="empty-state">No historical data.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={data}>
              <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
              <YAxis />
              <Tooltip
                labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                formatter={(value: number | string | undefined, name: string | undefined) => {
                  const n = Number(value ?? 0)
                  if (name === 'profitPct') return [`${n.toFixed(2)}%`, 'Profit %']
                  return [formatMoney(n, currency), name ?? 'Value']
                }}
              />
              <Line type="monotone" dataKey="close" name="Close price" dot={false} />
              <Line type="monotone" dataKey="positionValue" name="Position value" dot={false} />
              <Line type="monotone" dataKey="costBasis" name="Cost basis" dot={false} />
              <Line type="monotone" dataKey="profitAbs" name="Profit" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <h3>Position trades</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Currency</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.tradeDate).toLocaleDateString()}</td>
                    <td>{t.side === 'BUY' ? 'Buy' : 'Sell'}</td>
                    <td>{t.quantity}</td>
                    <td>{formatMoney(t.tradePrice, t.currency)}</td>
                    <td>{t.currency}</td>
                    <td>{t.category}</td>
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
