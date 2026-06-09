import { useEffect, useState } from 'react'
import { fetchAccounts, type FinancialAccount } from '../api/accountsApi'
import { fetchCategories, type CategoryNode } from '../api/categoriesApi'
import {
  commitCsvImport,
  fetchCsvPresets,
  previewCsvImport,
  type CsvPreset,
  type CsvPresetId,
  type CsvPreviewRow,
} from '../api/importApi'
import { BrokerCsvImportForm } from './BrokerCsvImportForm'

export function CsvImportForm() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [presets, setPresets] = useState<CsvPreset[]>([])
  const [presetId, setPresetId] = useState<CsvPresetId | ''>('mbank')
  const [csvText, setCsvText] = useState('')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [dateColumn, setDateColumn] = useState('Data operacji')
  const [amountColumn, setAmountColumn] = useState('Kwota')
  const [descriptionColumn, setDescriptionColumn] = useState('Opis operacji')
  const [typeColumn, setTypeColumn] = useState('Typ operacji')
  const [preview, setPreview] = useState<CsvPreviewRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [incomeSum, setIncomeSum] = useState(0)
  const [expenseSum, setExpenseSum] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchAccounts('BANK').then(setAccounts)
    void fetchCategories('EXPENSE').then(setCategories)
    void fetchCsvPresets()
      .then((list) => {
        setPresets(list)
        const mbank = list.find((p) => p.id === 'mbank')
        if (mbank) applyMapping(mbank.mapping)
      })
      .catch(() => {})
  }, [])

  function applyMapping(mapping: CsvPreset['mapping']) {
    setDateColumn(mapping.dateColumn)
    setAmountColumn(mapping.amountColumn)
    setDescriptionColumn(mapping.descriptionColumn ?? '')
    setTypeColumn(mapping.typeColumn ?? '')
  }

  function handlePresetChange(id: string) {
    const next = id as CsvPresetId | ''
    setPresetId(next)
    if (!next) return
    const preset = presets.find((p) => p.id === next)
    if (preset) applyMapping(preset.mapping)
  }

  async function handlePreview() {
    setMessage(null)
    const result = await previewCsvImport({
      csvText,
      mapping: {
        dateColumn,
        amountColumn,
        descriptionColumn: descriptionColumn || undefined,
        typeColumn: typeColumn || undefined,
      },
    })
    setHeaders(result.headers)
    setPreview(result.rows)
    setErrors(result.errors)
    setTotalRows(result.totalRows)
    setIncomeSum(result.incomeSum)
    setExpenseSum(result.expenseSum)
  }

  async function handleImport() {
    if (!accountId) {
      setMessage('Select a bank account')
      return
    }
    setMessage(null)
    try {
      const result = await commitCsvImport({
        csvText,
        mapping: {
          dateColumn,
          amountColumn,
          descriptionColumn: descriptionColumn || undefined,
          typeColumn: typeColumn || undefined,
        },
        accountId: Number(accountId),
        categoryId: categoryId === '' ? undefined : Number(categoryId),
      })
      const skippedPart =
        result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''
      setMessage(`Imported ${result.imported} transactions${skippedPart}`)
      setPreview([])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed')
    }
  }

  return (
    <>
      <div className="card">
        <h2>Bank import (CSV)</h2>
        <label className="form-full-width">
          CSV file (paste contents)
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
        </label>

        <div className="form-grid">
          <label>
            Template
            <select
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="">Custom mapping</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bank account
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category (optional)
            <select
              value={categoryId}
              onChange={(e) =>
                setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">— default —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date column
            <input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} />
          </label>
          <label>
            Amount column
            <input value={amountColumn} onChange={(e) => setAmountColumn(e.target.value)} />
          </label>
          <label>
            Description column
            <input
              value={descriptionColumn}
              onChange={(e) => setDescriptionColumn(e.target.value)}
            />
          </label>
          <label>
            Type column (optional)
            <input value={typeColumn} onChange={(e) => setTypeColumn(e.target.value)} />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-primary" onClick={() => void handlePreview()}>
            Preview
          </button>
          <button type="button" onClick={() => void handleImport()}>
            Import
          </button>
        </div>

        {headers.length > 0 && (
          <p className="loading-state">Columns in file: {headers.join(', ')}</p>
        )}
        {totalRows > 0 && (
          <p className="loading-state">
            Rows: {totalRows} · income: {incomeSum.toFixed(2)} · expenses:{' '}
            {expenseSum.toFixed(2)}
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
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
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
          </div>
        )}
      </div>

      <BrokerCsvImportForm />
    </>
  )
}
