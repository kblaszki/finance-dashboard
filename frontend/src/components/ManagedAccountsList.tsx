import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  type Account,
  type AccountType,
} from '../api/accountsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const TYPE_LABELS: Record<AccountType, string> = {
  BANK: 'Bank account',
  BROKERAGE: 'Brokerage account',
  MANUAL: 'Manual asset',
}

export function ManagedAccountsList() {
  const { data: accounts, error, loading, reload } = useAsyncData(fetchAccounts)
  const [formError, setFormError] = useState<string | null>(null)
  const [formType, setFormType] = useState<AccountType>('BANK')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('PLN')
  const [openingBalance, setOpeningBalance] = useState(0)

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm('Delete this account?')) return
      setFormError(null)
      try {
        await deleteAccount(id)
        reload()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [reload],
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    try {
      await createAccount({
        accountType: formType,
        name: name.trim(),
        currency,
        openingBalance,
      })
      setName('')
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const grouped = (['BANK', 'BROKERAGE', 'MANUAL'] as AccountType[]).map((type) => ({
    type,
    rows: (accounts ?? []).filter((a) => a.accountType === type),
  }))

  const bannerError = formError ?? error

  return (
    <div className="page-stack">
      {bannerError && <p className="error-banner">{bannerError}</p>}

      <section className="card">
        <h2>New account</h2>
        <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
          <select value={formType} onChange={(e) => setFormType(e.target.value as AccountType)}>
            <option value="BANK">Bank account</option>
            <option value="BROKERAGE">Brokerage account</option>
            <option value="MANUAL">Manual asset</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(Number(e.target.value))}
            placeholder="Opening balance"
          />
          <button type="submit" className="btn-primary">Add</button>
        </form>
      </section>

      {loading && !accounts ? (
        <p className="muted">Loading accounts…</p>
      ) : (
        grouped.map(({ type, rows }) => (
          <section className="card" key={type}>
            <h2>{TYPE_LABELS[type]}</h2>
            {!rows.length ? (
              <p className="muted">No accounts in this section.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Currency</th>
                    <th>Total balance</th>
                    <th>Cash</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a: Account) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/accounts/${a.id}`}>{a.name}</Link>
                      </td>
                      <td>{a.currency}</td>
                      <td>{formatMoney(a.totalBalance, a.currency)}</td>
                      <td className="muted">{formatMoney(a.cashBalance, a.currency)}</td>
                      <td className="table-actions">
                        <button type="button" className="btn-link danger" onClick={() => void handleDelete(a.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  )
}
