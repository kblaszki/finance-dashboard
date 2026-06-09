import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAccountTransactions,
  fetchBalanceHistory,
  fetchManagedAccounts,
  type BalanceHistoryPoint,
  type ManagedAccount,
} from '../api/accountsApi'
import { AccountBalanceChart } from '../components/AccountBalanceChart'
import { PortfolioTradesTable } from '../components/PortfolioTradesTable'
import { formatMoney } from '../utils/format'

export function AccountDetailPage() {
  const { id } = useParams()
  const accountId = Number(id)
  const [account, setAccount] = useState<ManagedAccount | null>(null)
  const [history, setHistory] = useState<BalanceHistoryPoint[]>([])
  const [bankTxs, setBankTxs] = useState<
    Array<{
      id: number
      date: string
      type: string
      amount: number
      currency: string
      category: string
      description: string | null
    }>
  >([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) return
    void load()
  }, [accountId])

  async function load() {
    setError(null)
    try {
      const accounts = await fetchManagedAccounts()
      const acc = accounts.find((a) => a.id === accountId) ?? null
      setAccount(acc)
      if (!acc) return
      const hist = await fetchBalanceHistory(accountId)
      setHistory(hist)
      if (acc.type === 'BANK') {
        const txs = await fetchAccountTransactions(accountId)
        setBankTxs(txs as typeof bankTxs)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }

  if (!account) {
    return (
      <div className="page">
        <p className="muted">{error ?? 'Loading…'}</p>
        <Link to="/accounts">← Accounts</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <p>
        <Link to="/accounts">← Accounts</Link>
      </p>
      <h1 className="page-title">{account.name}</h1>
      <p className="muted">
        {account.type === 'BANK' ? 'Bank account' : 'Brokerage account'} ·{' '}
        {account.balance != null ? formatMoney(account.balance, account.currency) : '—'}
      </p>
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>Balance history</h2>
        <AccountBalanceChart points={history} currency={account.currency} />
      </section>

      <section className="card">
        <h2>Activity</h2>
        {account.type === 'BANK' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bankTxs.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('en-US')}</td>
                  <td>{t.type}</td>
                  <td>{t.category}</td>
                  <td>{t.description ?? '—'}</td>
                  <td>{formatMoney(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <PortfolioTradesTable fixedPortfolioId={accountId} />
        )}
      </section>
    </div>
  )
}
