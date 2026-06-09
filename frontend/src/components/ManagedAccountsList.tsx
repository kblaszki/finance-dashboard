import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAccount,
  deleteAccount,
  fetchManagedAccounts,
  type ManagedAccount,
  type ManagedAccountType,
} from '../api/accountsApi'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const TYPE_LABELS: Record<ManagedAccountType, string> = {
  BANK: 'Bank account',
  BROKERAGE: 'Brokerage account',
}

export function ManagedAccountsList() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [formType, setFormType] = useState<ManagedAccountType>('BANK')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('PLN')
  const [openingBalance, setOpeningBalance] = useState(0)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setError(null)
    try {
      const rows = await fetchManagedAccounts()
      setAccounts(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createAccount({
        type: formType,
        name: name.trim(),
        currency,
        baseCurrency: currency,
        openingBalance: formType === 'BANK' ? openingBalance : undefined,
      })
      setName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this account?')) return
    try {
      await deleteAccount(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const bankAccounts = accounts.filter((a) => a.type === 'BANK')
  const brokerAccounts = accounts.filter((a) => a.type === 'BROKERAGE')

  function renderSection(_title: string, rows: ManagedAccount[]) {
    if (!rows.length) {
      return <p className="muted">No accounts in this section.</p>
    }
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Currency</th>
            <th>Balance</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <Link to={`/accounts/${a.id}`}>{a.name}</Link>
              </td>
              <td>{a.currency}</td>
              <td>
                {a.balance != null
                  ? formatMoney(a.balance, a.currency)
                  : '—'}
              </td>
              <td className="table-actions">
                <button type="button" className="btn-link danger" onClick={() => void handleDelete(a.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div>
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>New account</h2>
        <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
          <select value={formType} onChange={(e) => setFormType(e.target.value as ManagedAccountType)}>
            <option value="BANK">Bank account</option>
            <option value="BROKERAGE">Brokerage account</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {formType === 'BANK' && (
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
              placeholder="Opening balance"
            />
          )}
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>{TYPE_LABELS.BANK}</h2>
        {renderSection(TYPE_LABELS.BANK, bankAccounts)}
      </section>

      <section className="card">
        <h2>{TYPE_LABELS.BROKERAGE}</h2>
        {renderSection(TYPE_LABELS.BROKERAGE, brokerAccounts)}
      </section>
    </div>
  )
}
