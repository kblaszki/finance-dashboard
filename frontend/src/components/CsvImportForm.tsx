import { useEffect, useState } from 'react'
import { fetchAccounts, type FinancialAccount } from '../api/accountsApi'
import { fetchCategories, type CategoryNode } from '../api/categoriesApi'
import { commitCsvImport, previewCsvImport, type CsvPreviewRow } from '../api/importApi'

export function CsvImportForm() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [csvText, setCsvText] = useState('')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [dateColumn, setDateColumn] = useState('Data operacji')
  const [amountColumn, setAmountColumn] = useState('Kwota')
  const [descriptionColumn, setDescriptionColumn] = useState('Opis operacji')
  const [preview, setPreview] = useState<CsvPreviewRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchAccounts('BANK').then(setAccounts)
    void fetchCategories('EXPENSE').then(setCategories)
  }, [])

  async function handlePreview() {
    setMessage(null)
    const result = await previewCsvImport({
      csvText,
      mapping: { dateColumn, amountColumn, descriptionColumn },
    })
    setHeaders(result.headers)
    setPreview(result.rows)
    setErrors(result.errors)
    if (result.headers.length && !dateColumn) setDateColumn(result.headers[0] ?? '')
  }

  async function handleImport() {
    if (!accountId) {
      setMessage('Wybierz konto bankowe')
      return
    }
    setMessage(null)
    try {
      const result = await commitCsvImport({
        csvText,
        mapping: { dateColumn, amountColumn, descriptionColumn },
        accountId: Number(accountId),
        categoryId: categoryId === '' ? undefined : Number(categoryId),
      })
      setMessage(`Zaimportowano ${result.imported} transakcji`)
      setPreview([])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import nie powiódł się')
    }
  }

  return (
    <div className="card">
      <label className="form-full-width">
        Plik CSV (wklej zawartość)
        <textarea
          rows={8}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </label>

      <div className="form-grid">
        <label>
          Konto bankowe
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Wybierz…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kategoria (opcjonalnie)
          <select
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">— domyślna —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kolumna daty
          <input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} />
        </label>
        <label>
          Kolumna kwoty
          <input value={amountColumn} onChange={(e) => setAmountColumn(e.target.value)} />
        </label>
        <label>
          Kolumna opisu
          <input
            value={descriptionColumn}
            onChange={(e) => setDescriptionColumn(e.target.value)}
          />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={() => void handlePreview()}>
          Podgląd
        </button>
        <button type="button" onClick={() => void handleImport()}>
          Importuj
        </button>
      </div>

      {headers.length > 0 && (
        <p className="loading-state">Kolumny w pliku: {headers.join(', ')}</p>
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
                <th>Typ</th>
                <th>Kwota</th>
                <th>Opis</th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 20).map((row) => (
                <tr key={row.line}>
                  <td>{row.line}</td>
                  <td>{row.date}</td>
                  <td>{row.type}</td>
                  <td>{row.amount}</td>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 20 && (
            <p className="loading-state">… i {preview.length - 20} kolejnych wierszy</p>
          )}
        </div>
      )}
    </div>
  )
}
