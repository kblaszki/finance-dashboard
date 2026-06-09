import { useEffect, useState } from 'react'
import { fetchPortfolios, type InvestmentPortfolio } from '../api/portfoliosApi'
import {
  commitBrokerCsvImport,
  previewBrokerCsvImport,
  type BrokerCsvPreviewRow,
} from '../api/importApi'

export function BrokerCsvImportForm() {
  const [portfolios, setPortfolios] = useState<InvestmentPortfolio[]>([])
  const [portfolioId, setPortfolioId] = useState<number | ''>('')
  const [csvText, setCsvText] = useState('')
  const [dateColumn, setDateColumn] = useState('Date')
  const [symbolColumn, setSymbolColumn] = useState('Symbol')
  const [quantityColumn, setQuantityColumn] = useState('Quantity')
  const [priceColumn, setPriceColumn] = useState('Price')
  const [sideColumn, setSideColumn] = useState('Side')
  const [preview, setPreview] = useState<BrokerCsvPreviewRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchPortfolios().then(setPortfolios).catch(() => {})
  }, [])

  async function handlePreview() {
    setMessage(null)
    const result = await previewBrokerCsvImport({
      csvText,
      mapping: {
        dateColumn,
        symbolColumn,
        quantityColumn,
        priceColumn,
        sideColumn: sideColumn || undefined,
      },
    })
    setHeaders(result.headers)
    setPreview(result.rows)
    setErrors(result.errors)
    setTotalRows(result.totalRows)
  }

  async function handleImport() {
    if (!portfolioId) {
      setMessage('Select a brokerage account')
      return
    }
    setMessage(null)
    try {
      const result = await commitBrokerCsvImport({
        csvText,
        mapping: {
          dateColumn,
          symbolColumn,
          quantityColumn,
          priceColumn,
          sideColumn: sideColumn || undefined,
        },
        portfolioId: Number(portfolioId),
      })
      const skippedPart =
        result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''
      const errPart =
        result.errors.length > 0 ? ` (${result.errors.length} row errors)` : ''
      setMessage(
        `Imported ${result.imported} brokerage trades${skippedPart}${errPart}`,
      )
      if (result.errors.length > 0) setErrors(result.errors)
      setPreview([])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed')
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h2>Brokerage import (CSV)</h2>
      <p className="loading-state">
        BUY/SELL trade history for the selected account. Cash transfers are not created automatically.
      </p>

      <label className="form-full-width">
        CSV file (paste contents)
        <textarea
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </label>

      <div className="form-grid">
        <label>
          Brokerage account
          <select
            value={portfolioId}
            onChange={(e) =>
              setPortfolioId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">Select…</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.baseCurrency})
              </option>
            ))}
          </select>
        </label>
        <label>
          Date column
          <input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} />
        </label>
        <label>
          Symbol column
          <input value={symbolColumn} onChange={(e) => setSymbolColumn(e.target.value)} />
        </label>
        <label>
          Quantity column
          <input value={quantityColumn} onChange={(e) => setQuantityColumn(e.target.value)} />
        </label>
        <label>
          Price column
          <input value={priceColumn} onChange={(e) => setPriceColumn(e.target.value)} />
        </label>
        <label>
          Side column (optional)
          <input value={sideColumn} onChange={(e) => setSideColumn(e.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={() => void handlePreview()}>
          Preview
        </button>
        <button type="button" onClick={() => void handleImport()}>
          Import trades
        </button>
      </div>

      {headers.length > 0 && (
        <p className="loading-state">Columns in file: {headers.join(', ')}</p>
      )}
      {totalRows > 0 && (
        <p className="loading-state">
          Rows: {totalRows}
          {totalRows > preview.length && ` (preview: ${preview.length})`}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="auth-error">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      {message && <p className="loading-state">{message}</p>}

      {preview.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Date</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Quantity</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.line}>
                  <td>{row.line}</td>
                  <td>{row.date}</td>
                  <td>{row.symbol}</td>
                  <td>{row.side}</td>
                  <td>{row.quantity}</td>
                  <td>{row.tradePrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
