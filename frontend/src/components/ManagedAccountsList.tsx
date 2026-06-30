import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  type Account,
} from '../api/accountsApi'
import {
  ACCOUNT_TYPE_OPTIONS,
  type AccountType,
  typeLabel,
} from '../state/accountTypes'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

type SortKey = 'name' | 'totalBalance' | 'cashBalance'
type SortDir = 'asc' | 'desc'

function sortAccounts(rows: Account[], key: SortKey, dir: SortDir): Account[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'name') {
      return factor * a.name.localeCompare(b.name)
    }
    const av = key === 'totalBalance' ? a.totalBalance : a.cashBalance
    const bv = key === 'totalBalance' ? b.totalBalance : b.cashBalance
    return factor * (av - bv)
  })
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = activeKey === sortKey
  const indicator = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th>
      <button type="button" className="btn-link sort-header" onClick={() => onSort(sortKey)}>
        {label}
        {indicator}
      </button>
    </th>
  )
}

export function ManagedAccountsList() {
  const { data: accounts, error, loading, reload } = useAsyncData(fetchAccounts)
  const [formError, setFormError] = useState<string | null>(null)
  const [formType, setFormType] = useState<AccountType>('BANK')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('PLN')
  const [openingBalance, setOpeningBalance] = useState(0)
  const [typeFilter, setTypeFilter] = useState<AccountType | 'ALL'>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

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

  const grouped = useMemo(
    () =>
      ACCOUNT_TYPE_OPTIONS.map(({ value: type }) => ({
        type,
        rows: (accounts ?? []).filter((a) => a.accountType === type),
      })),
    [accounts],
  )

  const visibleGroups = useMemo(
    () =>
      (typeFilter === 'ALL' ? grouped : grouped.filter((g) => g.type === typeFilter)).map(
        ({ type, rows }) => ({
          type,
          rows: sortAccounts(rows, sortKey, sortDir),
        }),
      ),
    [grouped, typeFilter, sortKey, sortDir],
  )

  const bannerError = formError ?? error

  return (
    <div className="page-stack">
      {bannerError && <p className="error-banner">{bannerError}</p>}

      <section className="card">
        <h2>New account</h2>
        <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
          <select value={formType} onChange={(e) => setFormType(e.target.value as AccountType)}>
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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

      <section className="card">
        <h2>Filter</h2>
        <div className="inline-form">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AccountType | 'ALL')}
          >
            <option value="ALL">All account types</option>
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading && !accounts ? (
        <p className="muted">Loading accounts…</p>
      ) : (
        visibleGroups.map(({ type, rows }) => (
          <section className="card" key={type}>
            <h2>{typeLabel(type)}</h2>
            {!rows.length ? (
              <p className="muted">No accounts in this section.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader label="Name" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <th>Currency</th>
                    <SortableHeader
                      label="Total balance"
                      sortKey="totalBalance"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Cash"
                      sortKey="cashBalance"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    />
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
