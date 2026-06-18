import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAccount,
  fetchAccountValuations,
  type Account,
  type AccountValuationPoint,
} from '../api/accountsApi'
import { fetchAccountHoldings, type AccountHoldings } from '../api/holdingsApi'
import { AccountBalanceChart } from '../components/AccountBalanceChart'
import { AccountHoldingsTable } from '../components/AccountHoldingsTable'
import { formatMoney } from '../utils/format'

export function AccountDetailPage() {
  const { id } = useParams()
  const accountId = Number(id)
  const [account, setAccount] = useState<Account | null>(null)
  const [history, setHistory] = useState<AccountValuationPoint[]>([])
  const [holdings, setHoldings] = useState<AccountHoldings>({ open: [], closed: [] })
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
      if (acc.accountType === 'BROKERAGE') {
        setHoldings(await fetchAccountHoldings(accountId))
      } else {
        setHoldings({ open: [], closed: [] })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }

  if (!account) {
    return (
      <div className="page">
        <p className="muted">{error ?? 'Loading…'}</p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
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

      {account.accountType === 'BROKERAGE' && (
        <section className="card">
          <h2>Holdings</h2>
          <AccountHoldingsTable
            accountId={accountId}
            currency={account.currency}
            open={holdings.open}
            closed={holdings.closed}
          />
        </section>
      )}
    </div>
  )
}
