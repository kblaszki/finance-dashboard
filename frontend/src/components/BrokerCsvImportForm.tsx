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
  const [dateColumn, setDateColumn] = useState('Data')
  const [symbolColumn, setSymbolColumn] = useState('Symbol')
  const [quantityColumn, setQuantityColumn] = useState('Ilość')
  const [priceColumn, setPriceColumn] = useState('Cena')
  const [sideColumn, setSideColumn] = useState('Strona')
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
      setMessage('Wybierz portfel')
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
        result.skipped > 0 ? `, pominięto ${result.skipped} duplikatów` : ''
      const errPart =
        result.errors.length > 0 ? ` (${result.errors.length} błędów wierszy)` : ''
      setMessage(
        `Zaimportowano ${result.imported} transakcji maklerskich${skippedPart}${errPart}`,
      )
      if (result.errors.length > 0) setErrors(result.errors)
      setPreview([])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import nie powiódł się')
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h2>Import maklerski (CSV)</h2>
      <p className="loading-state">
        Historia transakcji BUY/SELL do wybranego portfela. Bez automatycznego transferu gotówki.
      </p>

      <label className="form-full-width">
        Plik CSV (wklej zawartość)
        <textarea
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </label>

      <div className="form-grid">
        <label>
          Portfel
          <select
            value={portfolioId}
            onChange={(e) =>
              setPortfolioId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">Wybierz…</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.baseCurrency})
              </option>
            ))}
          </select>
        </label>
        <label>
          Kolumna daty
          <input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} />
        </label>
        <label>
          Kolumna symbolu
          <input value={symbolColumn} onChange={(e) => setSymbolColumn(e.target.value)} />
        </label>
        <label>
          Kolumna ilości
          <input value={quantityColumn} onChange={(e) => setQuantityColumn(e.target.value)} />
        </label>
        <label>
          Kolumna ceny
          <input value={priceColumn} onChange={(e) => setPriceColumn(e.target.value)} />
        </label>
        <label>
          Kolumna strony (opcjonalnie)
          <input value={sideColumn} onChange={(e) => setSideColumn(e.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={() => void handlePreview()}>
          Podgląd
        </button>
        <button type="button" onClick={() => void handleImport()}>
          Importuj transakcje
        </button>
      </div>

      {headers.length > 0 && (
        <p className="loading-state">Kolumny w pliku: {headers.join(', ')}</p>
      )}
      {totalRows > 0 && (
        <p className="loading-state">
          Wierszy: {totalRows}
          {totalRows > preview.length && ` (podgląd: ${preview.length})`}
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
                <th>Linia</th>
                <th>Data</th>
                <th>Symbol</th>
                <th>Strona</th>
                <th>Ilość</th>
                <th>Cena</th>
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
