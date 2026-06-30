import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAccounts, type Account } from '../api/accountsApi'
import {
  importBankTransactions,
  importBrokerTrades,
  type BankImportResult,
  type ImportResult,
} from '../api/importApi'
import { useAsyncData } from '../hooks/useAsyncData'

type ImportTarget = 'bank' | 'broker'

export function ImportPage() {
  const { data: accounts, error: accountsError } = useAsyncData(fetchAccounts)
  const bankAccounts = useMemo(
    () => (accounts ?? []).filter((a: Account) => a.accountType === 'BANK'),
    [accounts],
  )
  const brokerageAccounts = useMemo(
    () => (accounts ?? []).filter((a: Account) => a.accountType === 'BROKERAGE'),
    [accounts],
  )

  const [target, setTarget] = useState<ImportTarget>('bank')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [bankPreset, setBankPreset] = useState<'mbank' | 'generic'>('mbank')
  const [fileName, setFileName] = useState<string | null>(null)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportResult | BankImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const accountOptions = target === 'bank' ? bankAccounts : brokerageAccounts

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

  async function runImport(dryRun: boolean) {
    if (!csvText) {
      setError('Choose a CSV file first')
      return
    }
    if (!accountId) {
      setError('Select an account')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (target === 'bank') {
        const result = await importBankTransactions({
          accountId: Number(accountId),
          bank: bankPreset,
          csv: csvText,
          filename: fileName ?? undefined,
          dryRun,
        })
        setPreview(result)
      } else {
        const result = await importBrokerTrades({
          accountId: Number(accountId),
          csv: csvText,
          filename: fileName ?? undefined,
          dryRun,
        })
        setPreview(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Import (FR-019)</h1>
      <p className="muted page-lead">
        Upload bank or brokerage CSV exports. Preview before commit; duplicates are skipped by date,
        amount, and description.
      </p>
      {accountsError && <p className="error-banner">{accountsError}</p>}
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>Import settings</h2>
        <div className="inline-form">
          <select value={target} onChange={(e) => setTarget(e.target.value as ImportTarget)}>
            <option value="bank">Bank transactions</option>
            <option value="broker">Brokerage trades (XTB)</option>
          </select>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select account</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
          {target === 'bank' && (
            <select value={bankPreset} onChange={(e) => setBankPreset(e.target.value as 'mbank' | 'generic')}>
              <option value="mbank">mBank (PL)</option>
              <option value="generic">Generic CSV</option>
            </select>
          )}
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </div>
        {target === 'bank' ? (
          <p className="muted">
            mBank: Historia → Eksportuj do CSV. Generic: columns for date, description, and amount
            (comma or semicolon).
          </p>
        ) : (
          <p className="muted">
            XTB: Account history → Export CSV. Or use import on the{' '}
            <Link to="/accounts">account detail</Link> page.
          </p>
        )}
        <div className="inline-form">
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => void runImport(true)}>
            Preview
          </button>
          <button type="button" className="btn-primary" disabled={loading} onClick={() => void runImport(false)}>
            Import
          </button>
        </div>
      </section>

      {preview && (
        <section className="card">
          <h2>{preview.dryRun ? 'Preview' : 'Import result'}</h2>
          <p>
            Parsed: {preview.parsed}, imported: {preview.imported}, skipped: {preview.skipped}
            {preview.errors.length > 0 ? `, errors: ${preview.errors.length}` : ''}
          </p>
          {preview.errors.length > 0 && (
            <ul className="category-breakdown-list">
              {preview.errors.map((err) => (
                <li key={`${err.row}-${err.message}`}>
                  <span>Row {err.row}</span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
          )}
          {preview.preview && preview.preview.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 50).map((row) => {
                    const isBank = 'transactionType' in row
                    return (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td>
                          {isBank
                            ? row.date.slice(0, 10)
                            : row.tradeDate.slice(0, 10)}
                        </td>
                        <td>
                          {isBank ? row.description : row.symbol ?? row.kind}
                        </td>
                        <td>{isBank ? row.transactionType : row.kind}</td>
                        <td>
                          {(isBank ? row.amount : row.amount ?? row.quantity ?? 0).toFixed(2)}{' '}
                          {row.currency}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
