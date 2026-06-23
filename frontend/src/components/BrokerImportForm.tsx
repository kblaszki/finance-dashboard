import { useState } from 'react'
import { importBrokerTrades, type ImportResult } from '../api/importApi'

type Props = {
  accountId: number
  onImported: () => void
}

export function BrokerImportForm({ accountId, onImported }: Props) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPreview(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setCsvText(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsText(file)
  }

  async function handleDryRun() {
    if (!csvText) {
      setError('Choose a CSV file first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await importBrokerTrades({
        accountId,
        csv: csvText,
        filename: fileName ?? undefined,
        dryRun: true,
      })
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!csvText) {
      setError('Choose a CSV file first')
      return
    }
    if (!confirm('Import trades from CSV into this account?')) return
    setLoading(true)
    setError(null)
    try {
      const result = await importBrokerTrades({
        accountId,
        csv: csvText,
        filename: fileName ?? undefined,
        dryRun: false,
      })
      setPreview(result)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-stack">
      <p className="muted">
        XTB export: Account history → Closed positions or Cash operations → Export CSV (semicolon).
        Remove lines above the header and the Total row.
      </p>
      <div className="inline-form">
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        <button type="button" className="btn-primary" disabled={loading || !csvText} onClick={() => void handleDryRun()}>
          Preview
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !csvText || !preview}
          onClick={() => void handleImport()}
        >
          Import
        </button>
      </div>
      {fileName && <p className="muted">File: {fileName}</p>}
      {error && <p className="error-banner">{error}</p>}
      {preview && (
        <div>
          <p className="muted">
            Parsed {preview.parsed} · Imported {preview.imported} · Skipped {preview.skipped}
            {preview.dryRun ? ' (preview)' : ''}
          </p>
          {preview.errors.length > 0 && (
            <ul className="error-list">
              {preview.errors.map((e) => (
                <li key={`${e.row}-${e.message}`}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
          {preview.preview && preview.preview.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Kind</th>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.kind}</td>
                      <td>{new Date(row.tradeDate).toLocaleDateString('en-US')}</td>
                      <td>{row.symbol ?? '—'}</td>
                      <td>{row.side ?? '—'}</td>
                      <td>{row.quantity ?? '—'}</td>
                      <td>{row.price ?? '—'}</td>
                      <td>{row.amount ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
