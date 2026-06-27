import { useCallback, useState } from 'react'
import { fetchTaxReport, type TaxReport } from '../api/statsApi'
import { downloadTaxReportCsv } from '../api/taxReportApi'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

const CURRENT_YEAR = new Date().getFullYear();

export function TaxReportPage() {
  const { currency } = useCurrency()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [report, setReport] = useState<TaxReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTaxReport(year, currency)
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [year, currency])

  async function handleDownload() {
    setError(null)
    try {
      await downloadTaxReportCsv(year, currency)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download CSV')
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)

  return (
    <div className="page">
      <h1 className="page-title">Tax report (PL)</h1>
      <p className="muted tax-disclaimer">
        Estimates for personal use only — not tax advice. Verify against broker statements and
        official PIT-38 before filing. FX uses latest NBP rates, not historical sale-date rates.
        Cost basis: FIFO per Polish securities practice.
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
          <button type="button" className="btn-primary" disabled={loading} onClick={() => void loadReport()}>
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
        {error && <p className="error-banner">{error}</p>}
      </section>

      {report && (
        <>
          <section className="card">
            <h2>Summary ({report.displayCurrency})</h2>
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
                <p className="muted">Est. Belka (19%)</p>
                <p>{formatMoney(report.estimatedBelka, report.displayCurrency)}</p>
              </div>
              <div>
                <p className="muted">Dividends (gross)</p>
                <p>{formatMoney(report.dividendsGross, report.displayCurrency)}</p>
              </div>
            </div>
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
