import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchTaxReport, type TaxReport } from '../../../api/statsApi'
import { downloadTaxReportCsv } from '../../../api/taxReportApi'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useCurrency } from '../../../state/currency'
import { formatMoney } from '../../../utils/format'

const CURRENT_YEAR = new Date().getFullYear();

type TaxReportQuery = { year: number; currency: string };

function parseYearParam(raw: string | undefined): number {
  if (!raw) return CURRENT_YEAR;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return CURRENT_YEAR;
  return year;
}

export function TaxReportPage() {
  const { currency } = useCurrency()
  const navigate = useNavigate()
  const params = useParams()
  const routeYear = parseYearParam(params.year)
  const [year, setYear] = useState(routeYear)
  const [query, setQuery] = useState<TaxReportQuery | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    setYear(routeYear)
    setQuery({ year: routeYear, currency })
  }, [routeYear, currency])

  const loader = useCallback(async (): Promise<TaxReport | null> => {
    if (!query) return null
    return fetchTaxReport(query.year, query.currency)
  }, [query])

  const { data: report, error, loading } = useAsyncData(loader)

  function handleLoad() {
    setQuery({ year, currency })
    navigate(year === CURRENT_YEAR ? '/tax' : `/tax/${year}`, { replace: true })
  }

  async function handleDownload() {
    setDownloadError(null)
    try {
      await downloadTaxReportCsv(year, currency)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Failed to download CSV')
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)
  const displayError = error ?? downloadError

  return (
    <div className="page">
      <h1 className="page-title">Tax report (PL) — {year}</h1>
      <p className="muted page-lead">
        PIT-38 estimates (FR-022), Belka on interest (FR-027), and PIT/ZG helper (FR-028). Not tax
        advice — verify before filing. FX uses latest NBP rates; FIFO includes commissions.
      </p>
        <p className="muted">
          Record dividends and interest in <Link to="/income-events">Income events</Link> for accurate
          Belka and foreign income sections. Configure wrappers in{' '}
          <Link to="/tax/settings">Tax settings</Link>, view{' '}
          <Link to={`/tax/${year}/overview`}>annual overview</Link> or{' '}
          <Link to="/tax/calendar">filing calendar</Link>.
        </p>

      <section className="card">
        <h2>Tax year</h2>
        <div className="inline-form">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary" disabled={loading} onClick={handleLoad}>
            {loading ? 'Loading…' : 'Load report'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!report}
            onClick={() => void handleDownload()}
          >
            Download CSV
          </button>
        </div>
        {displayError && <p className="error-banner">{displayError}</p>}
        {report && report.warnings.length > 0 && (
          <div className="error-banner" role="alert">
            <p>
              <strong>FIFO warnings:</strong> Some holdings have inconsistent lot chains and were
              excluded from realized gains.
            </p>
            <ul>
              {report.warnings.map((w) => (
                <li key={`${w.holdingId}-${w.message}`}>
                  {w.accountName} / {w.symbol}: {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {report && (
        <>
          <section className="card">
            <h2>PIT-38 summary ({report.displayCurrency})</h2>
            <div className="kpi-grid">
              <div>
                <p className="muted">Realized gains</p>
                <p>{formatMoney(report.realizedGains, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Realized losses</p>
                <p>{formatMoney(report.realizedLosses, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Net realized</p>
                <p>{formatMoney(report.netRealized, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Est. Belka on gains (19%)</p>
                <p>{formatMoney(report.estimatedBelka, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Dividends (gross)</p>
                <p>{formatMoney(report.dividendsGross, report.displayCurrency)}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Loss carryforward (PIT-38)</h2>
            <p>
              Remaining from prior years:{' '}
              {formatMoney(report.lossCarryforward.remainingTotal, report.displayCurrency)}
            </p>
            {report.lossCarryforward.appliedThisYear.length > 0 ? (
              <p className="muted">
                Applied this year:{' '}
                {report.lossCarryforward.appliedThisYear
                  .map((r) => `${r.taxYear}: ${formatMoney(r.amount, report.displayCurrency)}`)
                  .join('; ')}
              </p>
            ) : (
              <p className="muted">No prior losses applied to this tax year.</p>
            )}
            {report.lossCarryforward.suggestedNewLoss ? (
              <p className="muted">
                Net loss this year — consider recording carryforward for{' '}
                {report.lossCarryforward.suggestedNewLoss.taxYear}:{' '}
                {formatMoney(
                  report.lossCarryforward.suggestedNewLoss.lossAmount,
                  report.displayCurrency,
                )}
                . Manage rows in <Link to="/tax/settings">Tax settings</Link>.
              </p>
            ) : null}
            {report.lossCarryforward.rows.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Origin year</th>
                      <th>Loss</th>
                      <th>Used</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lossCarryforward.rows.map((row) => (
                      <tr key={row.taxYear}>
                        <td>{row.taxYear}</td>
                        <td>{formatMoney(row.lossAmount, report.displayCurrency)}</td>
                        <td>{formatMoney(row.usedAmount, report.displayCurrency)}</td>
                        <td>{formatMoney(row.remainingAmount, report.displayCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Belka — deposits &amp; bonds (FR-027)</h2>
            <div className="kpi-grid">
              <div>
                <p className="muted">Interest gross</p>
                <p>{formatMoney(report.belka.interestGross, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Withheld tax</p>
                <p>{formatMoney(report.belka.withheldTax, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Est. Belka due</p>
                <p>{formatMoney(report.belka.estimatedBelkaDue, report.displayCurrency)}</p>
              </div>
            </div>
            {report.belka.rows.length === 0 ? (
              <p className="muted">No Belka-taxed income events in this year.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Withheld</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.belka.rows.map((row) => (
                      <tr key={`${row.occurredOn}-${row.accountName}-${row.amount}`}>
                        <td>{new Date(row.occurredOn).toLocaleDateString('en-US')}</td>
                        <td>{row.accountName}</td>
                        <td>{row.eventType}</td>
                        <td>{formatMoney(row.amount, row.currency)}</td>
                        <td>{formatMoney(row.withheldTax, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>PIT/ZG foreign income (FR-028)</h2>
            {report.pitZg.length === 0 ? (
              <p className="muted">No foreign income events for this year.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th>Symbol</th>
                      <th>Income gross</th>
                      <th>Withheld</th>
                      <th>Foreign tax paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.pitZg.map((row) => (
                      <tr key={`${row.country}-${row.symbol ?? ''}`}>
                        <td>{row.country}</td>
                        <td>{row.symbol ?? '—'}</td>
                        <td>{formatMoney(row.incomeGross, report.displayCurrency)}</td>
                        <td>{formatMoney(row.withheldTax, report.displayCurrency)}</td>
                        <td>{formatMoney(row.foreignTaxPaid, report.displayCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Derivatives (FR-025)</h2>
            <p className="muted">{report.derivatives.message}</p>
            {report.derivatives.sellCount > 0 && (
              <p>Sell events flagged: {report.derivatives.sellCount}</p>
            )}
          </section>

          <section className="card">
            <h2>Rental — PIT-36 helper (FR-026)</h2>
            {report.rental.available ? (
              <div className="kpi-grid">
                <div>
                  <p className="muted">Rental income</p>
                  <p>{formatMoney(report.rental.rentalIncome, report.displayCurrency)}</p>
                </div>
                <div>
                  <p className="muted">Maintenance</p>
                  <p>{formatMoney(report.rental.maintenanceCosts, report.displayCurrency)}</p>
                </div>
                <div>
                  <p className="muted">Net rent</p>
                  <p>
                    {formatMoney(
                      report.rental.rentalIncome - report.rental.maintenanceCosts,
                      report.displayCurrency,
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="muted">{report.rental.message}</p>
            )}
          </section>

          <section className="card">
            <h2>By instrument</h2>
            {report.byInstrument.length === 0 ? (
              <p className="muted">No realized sales in this year.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Net realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byInstrument.map((row) => (
                      <tr key={row.symbol}>
                        <td>{row.symbol}</td>
                        <td>{formatMoney(row.netRealized, report.displayCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Sales detail</h2>
            {report.sellRows.length === 0 ? (
              <p className="muted">No sell lots in this tax year.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Symbol</th>
                      <th>Account</th>
                      <th>Qty</th>
                      <th>Proceeds</th>
                      <th>Cost</th>
                      <th>Gain/loss</th>
                      <th>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sellRows.map((row, idx) => (
                      <tr key={`${row.saleDate}-${row.symbol}-${idx}`}>
                        <td>{new Date(row.saleDate).toLocaleDateString('en-US')}</td>
                        <td>{row.symbol}</td>
                        <td>{row.accountName}</td>
                        <td>{row.quantity}</td>
                        <td>{formatMoney(row.proceeds, report.displayCurrency)}</td>
                        <td>{formatMoney(row.cost, report.displayCurrency)}</td>
                        <td>{formatMoney(row.gainLoss, report.displayCurrency)}</td>
                        <td>{row.pitZgCountry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
