import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchNetWorth } from '../api/statsApi'
import { refreshPortfolioMarketData } from '../api/portfolioApi'
import { useCurrency } from '../state/currency'

export function MarketDataBanner() {
  const { currency } = useCurrency()
  const [staleCount, setStaleCount] = useState(0)
  const [pricedCount, setPricedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [currency])

  async function load() {
    try {
      const data = await fetchNetWorth(currency)
      setStaleCount(data.stalePositionsCount ?? 0)
      setPricedCount(data.pricedPositionsCount ?? 0)
      setTotalCount(data.totalPositionsCount ?? 0)
    } catch {
      setStaleCount(0)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setMessage(null)
    try {
      const result = await refreshPortfolioMarketData()
      setMessage(
        `Refreshed ${result.symbolsProcessed}/${result.requested} symbols${
          result.errors.length ? ` (${result.errors.length} errors)` : ''
        }`,
      )
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to refresh market data')
    } finally {
      setRefreshing(false)
    }
  }

  if (staleCount <= 0 && totalCount === 0) return null
  if (staleCount <= 0 && pricedCount === totalCount) return null

  return (
    <div className="market-data-banner" role="status">
      <p>
        {staleCount > 0
          ? `Some positions have stale market data (${staleCount}${
              totalCount ? ` of ${totalCount}` : ''
            }). Portfolio valuation may be inaccurate.`
          : `Some positions are not priced (${pricedCount}/${totalCount} priced).`}
      </p>
      <div className="market-data-banner-actions">
        <button type="button" className="btn-secondary" onClick={() => void handleRefresh()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh EOD prices'}
        </button>
        <Link to="/accounts" className="btn-secondary">
          Go to accounts
        </Link>
      </div>
      {message && <p className="loading-state">{message}</p>}
    </div>
  )
}
