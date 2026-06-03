import { useEffect, useState } from 'react'
import { fetchSummaryStats } from '../api/statsApi'
import { useCurrency } from '../state/currency'
import { usePeriod } from '../state/period'
import { formatMoney } from '../utils/format'

export function KpiCards() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchSummaryStats>> | null>(null)
  const { currency } = useCurrency()
  const { range } = usePeriod()

  useEffect(() => {
    void load()
  }, [currency, range.from, range.to])

  async function load() {
    const data = await fetchSummaryStats({
      currency,
      from: range.from,
      to: range.to,
    })
    setStats(data)
  }

  if (!stats) {
    return <p className="loading-state">Ładowanie KPI...</p>
  }

  const income = Number(stats.income ?? 0)
  const expenses = Number(stats.expenses ?? 0)
  const balance = Number(stats.balance ?? 0)
  const portfolioValue = Number(stats.portfolioValue ?? 0)

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Przychody (okres)</h3>
        <p>{formatMoney(income, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Wydatki (okres)</h3>
        <p>{formatMoney(expenses, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Przepływ netto (okres)</h3>
        <p>{formatMoney(balance, currency)}</p>
        <small>Przychody − wydatki (transakcje globalne)</small>
      </div>
      <div className="kpi-card">
        <h3>Makler — razem (dziś)</h3>
        <p>{formatMoney(portfolioValue, currency)}</p>
        <small>
          Papiery: {formatMoney(Number(stats.brokerSecurities ?? 0), currency)} · Gotówka:{' '}
          {formatMoney(Number(stats.brokerCash ?? 0), currency)}
          {stats.portfolioValueMarketDataAsOf
            ? ` · EOD: ${new Date(stats.portfolioValueMarketDataAsOf).toLocaleDateString()}`
            : ''}
        </small>
      </div>
      <div className="kpi-card">
        <h3>Transakcje (okres)</h3>
        <p>{stats.transactionsCount}</p>
        <small>
          {typeof stats.pricedPositionsCount === 'number' &&
          typeof stats.totalPositionsCount === 'number'
            ? `Wycenione pozycje: ${stats.pricedPositionsCount}/${stats.totalPositionsCount}${
                stats.stalePositionsCount ? `, nieświeże: ${stats.stalePositionsCount}` : ''
              }`
            : null}
        </small>
      </div>
    </div>
  )
}
