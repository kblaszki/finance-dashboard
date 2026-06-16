import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAccount,
  fetchAccountValuations,
  type Account,
  type AccountValuationPoint,
} from '../api/accountsApi'
import { fetchTransactions, type Transaction } from '../api/transactionsApi'
import { AccountBalanceChart } from '../components/AccountBalanceChart'
import { HoldingLotsTable } from '../components/HoldingLotsTable'
import { formatMoney } from '../utils/format'

export function AccountDetailPage() {
  const { id } = useParams()
  const accountId = Number(id)
  const [account, setAccount] = useState<Account | null>(null)
  const [history, setHistory] = useState<AccountValuationPoint[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) return
    void load()
  }, [accountId])

  async function load() {
    setError(null)
    try {
      const acc = await fetchAccount(accountId)
      setAccount(acc)
      setHistory(await fetchAccountValuations(accountId))
      if (acc.accountType === 'BANK') {
        setTransactions(await fetchTransactions({ accountId }))
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
        {account.accountType} · Cash {formatMoney(account.cashBalance, account.currency)}
      </p>
      {error && <p className="error-banner">{error}</p>}

      <section className="card">
        <h2>Account value history</h2>
        <AccountBalanceChart
          points={history}
          currency={account.currency}
          showComponents={account.accountType === 'BROKERAGE'}
        />
      </section>

      <section className="card">
        <h2>Activity</h2>
        {account.accountType === 'BANK' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Balance after</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.date).toLocaleDateString('en-US')}</td>
                  <td>{t.transactionType}</td>
                  <td>{t.category}</td>
                  <td>{formatMoney(t.amount, t.currency)}</td>
                  <td>{formatMoney(t.balanceAfter, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <HoldingLotsTable accountId={accountId} currency={account.currency} />
        )}
      </section>
    </div>
  )
}
