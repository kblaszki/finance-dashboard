import { useState } from 'react'
import { fetchBenchmarkComparison } from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { usePeriod } from '../state/period'

function formatReturnPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function BenchmarkComparison() {
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const [benchmark, setBenchmark] = useState<'WIG' | 'SP500'>('SP500')
  const { data, error, loading } = useAsyncData(
    () =>
      fetchBenchmarkComparison({
        from: range.from,
        to: range.to,
        currency,
        benchmark,
      }),
    [currency, range.from, range.to, benchmark],
  )

  return (
    <div className="card">
      <h2>Benchmark comparison</h2>
      <div className="inline-form form-section-gap">
        <select value={benchmark} onChange={(e) => setBenchmark(e.target.value as 'WIG' | 'SP500')}>
          <option value="SP500">S&amp;P 500 (SPY)</option>
          <option value="WIG">WIG (WIG20)</option>
        </select>
      </div>
      {loading && <p className="loading-state">Loading…</p>}
      {error && <p className="error-banner">{error}</p>}
      {data && !loading && (
        <ul className="stat-list">
          <li className="stat-row">
            <span className="stat-row-label">Your portfolio</span>
            <span className={`stat-row-value ${(data.portfolioReturnPct ?? 0) >= 0 ? 'positive' : 'negative'}`}>
              {formatReturnPct(data.portfolioReturnPct)}
            </span>
          </li>
          <li className="stat-row">
            <span className="stat-row-label">{data.benchmarkLabel}</span>
            <span className={`stat-row-value ${(data.benchmarkReturnPct ?? 0) >= 0 ? 'positive' : 'negative'}`}>
              {formatReturnPct(data.benchmarkReturnPct)}
            </span>
          </li>
        </ul>
      )}
    </div>
  )
}
