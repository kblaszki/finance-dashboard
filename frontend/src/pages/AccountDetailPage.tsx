import { useCallback } from 'react'
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
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type AccountDetailData = {
  account: Account
  history: AccountValuationPoint[]
  holdings: AccountHoldings
}

async function loadAccountDetail(accountId: number): Promise<AccountDetailData> {
  const account = await fetchAccount(accountId)
  const history = await fetchAccountValuations(accountId)
  const holdings =
    account.accountType === 'BROKERAGE'
      ? await fetchAccountHoldings(accountId)
      : { open: [], closed: [] }
  return { account, history, holdings }
}

export function AccountDetailPage() {
  const { id } = useParams()
  const accountId = Number(id)
  const loader = useCallback(() => loadAccountDetail(accountId), [accountId])
  const { data, error, loading } = useAsyncData(loader, [accountId])

  if (!accountId || loading) {
    return (
      <div className="page">
        <p className="muted">{error ?? 'Loading…'}</p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page">
        <p className="error-banner">{error ?? 'Failed to load account'}</p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </div>
    )
  }

  const { account, history, holdings } = data

  return (
    <div className="page">
      <p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </p>
      <h1 className="page-title">{account.name}</h1>
      <p className="muted">
        {account.accountType} · Cash {formatMoney(account.cashBalance, account.currency)}
      </p>

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
