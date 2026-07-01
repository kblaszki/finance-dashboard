import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchTaxOverview } from '../../../api/taxOverviewApi'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useCurrency } from '../../../state/currency'
import { formatMoney } from '../../../utils/format'

const CURRENT_YEAR = new Date().getFullYear()

export function TaxOverviewPage() {
  const { currency } = useCurrency()
  const params = useParams()
  const navigate = useNavigate()
  const routeYear = Number(params.year) || CURRENT_YEAR
  const [year, setYear] = useState(routeYear)

  const loader = useCallback(
    () => fetchTaxOverview(year, currency, true),
    [year, currency],
  )
  const { data, error, loading, reload } = useAsyncData(loader)

  function handleLoad() {
    reload()
    navigate(`/tax/${year}/overview`, { replace: true })
  }

  if (loading && !data) return <p className="muted page">Loading overview…</p>

  return (
    <div className="page">
      <header className="page-header">
        <h1>Tax overview — {year}</h1>
        <p className="muted">Consolidated annual summary (FR-046).</p>
        <p>
          <Link to={`/tax/${year}`}>PIT-38 detail</Link> · <Link to="/tax/calendar">Calendar</Link> ·{' '}
          <Link to="/tax/settings">Tax settings</Link>
        </p>
      </header>

      <section className="card inline-form">
        <label>
          Year
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2000}
            max={2100}
          />
        </label>
        <button type="button" className="btn-primary" onClick={handleLoad}>
          Load
        </button>
      </section>

      {data?.correction.needed && data.correction.message ? (
        <p className="error-banner">{data.correction.message}</p>
      ) : null}
      {error ? <p className="error-banner">{error}</p> : null}

      {data ? (
        <>
          <section className="card">
            <h2>Estimated total tax due</h2>
            <p className="kpi-value">{formatMoney(data.estimatedTotalTaxDue, data.displayCurrency)}</p>
            <p className="muted">
              PIT-38 {formatMoney(data.pit38.estimatedPit38Tax, data.displayCurrency)} + Belka{' '}
              {formatMoney(data.pit38.belka.estimatedBelkaDue, data.displayCurrency)} − advances{' '}
              {formatMoney(data.taxLiabilities.advancesPaid, data.displayCurrency)}
            </p>
          </section>

          <section className="card">
            <h2>PIT-38 (securities)</h2>
            <p>
              Net realized: {formatMoney(data.pit38.netRealized, data.displayCurrency)} → after losses{' '}
              {formatMoney(data.pit38.netRealizedAfterLosses, data.displayCurrency)}
            </p>
            {data.pit38.lossCarryforward.appliedThisYear.length > 0 ? (
              <p className="muted">
                Losses applied:{' '}
                {data.pit38.lossCarryforward.appliedThisYear
                  .map((r) => `${r.taxYear}: ${r.amount}`)
                  .join(', ')}
              </p>
            ) : null}
          </section>

          <section className="card">
            <h2>Crypto (PIT scale)</h2>
            <p>{data.crypto.message}</p>
            <p>
              Net: {formatMoney(data.crypto.netRealized, data.displayCurrency)} ({data.crypto.sellRows.length}{' '}
              disposals)
            </p>
          </section>

          <section className="card">
            <h2>Rental</h2>
            <p>
              Taxable base: {formatMoney(data.pit38.rental.taxableBase, data.displayCurrency)} (
              {data.pit38.rental.message})
            </p>
          </section>

          <section className="card">
            <h2>Property sales</h2>
            <p>
              Taxable gains: {formatMoney(data.propertySales.totalTaxableGain, data.displayCurrency)} (
              {data.propertySales.rows.length} sales)
            </p>
          </section>

          <section className="card">
            <h2>Loss carryforward balance</h2>
            <p>
              Remaining total:{' '}
              {formatMoney(data.pit38.lossCarryforward.remainingTotal, data.displayCurrency)}
            </p>
            {data.pit38.lossCarryforward.suggestedNewLoss ? (
              <p className="muted">
                Suggested new loss row for {data.pit38.lossCarryforward.suggestedNewLoss.taxYear}:{' '}
                {formatMoney(data.pit38.lossCarryforward.suggestedNewLoss.lossAmount, data.displayCurrency)}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
