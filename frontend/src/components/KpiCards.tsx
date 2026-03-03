import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

interface SummaryStats {
  income: number
  expenses: number
  balance: number
  portfolioValue: number
  transactionsCount: number
  currency?: string
  fxAsOf?: string
}

export function KpiCards() {
  const [stats, setStats] = useState<SummaryStats | null>(null)
  const { currency } = useCurrency()

  useEffect(() => {
    void load()
  }, [currency])

  async function load() {
    const data = await apiClient.get<SummaryStats>(
      `/api/stats/summary?currency=${encodeURIComponent(currency)}`,
    )
    setStats(data)
  }

  if (!stats) {
    return <p>Ładowanie KPI...</p>
  }

  const income = Number(stats.income ?? 0)
  const expenses = Number(stats.expenses ?? 0)
  const balance = Number(stats.balance ?? 0)
  const portfolioValue = Number(stats.portfolioValue ?? 0)

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <h3>Przychody</h3>
        <p>{formatMoney(income, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Wydatki</h3>
        <p>{formatMoney(expenses, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Saldo</h3>
        <p>{formatMoney(balance, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Wartość portfela</h3>
        <p>{formatMoney(portfolioValue, currency)}</p>
      </div>
      <div className="kpi-card">
        <h3>Transakcje (łącznie)</h3>
        <p>{stats.transactionsCount}</p>
      </div>
    </div>
  )
}

