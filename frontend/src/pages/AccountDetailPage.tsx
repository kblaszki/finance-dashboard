import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAccount,
  fetchAccountValuations,
  type Account,
  type AccountValuationPoint,
} from '../api/accountsApi'
import { createHolding, fetchAccountHoldings, type AccountHoldings } from '../api/holdingsApi'
import { AccountBalanceChart } from '../components/AccountBalanceChart'
import { AccountHoldingsTable } from '../components/AccountHoldingsTable'
import { InstrumentPicker } from '../components/InstrumentPicker'
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
  const invalidId = !Number.isFinite(accountId) || accountId < 1
  const loader = useCallback(async () => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      throw new Error('Invalid account ID')
    }
    return loadAccountDetail(accountId)
  }, [accountId])
  const { data, error, loading, reload } = useAsyncData(loader, [accountId])
  const [instrumentId, setInstrumentId] = useState<number | null>(null)
  const [holdingError, setHoldingError] = useState<string | null>(null)

  if (invalidId) {
    return (
      <div className="page">
        <p className="error-banner">Invalid account ID</p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </div>
    )
  }

  if (loading) {
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

  async function handleAddHolding(e: React.FormEvent) {
    e.preventDefault()
    if (!instrumentId) {
      setHoldingError('Select an instrument')
      return
    }
    setHoldingError(null)
    try {
      await createHolding(accountId, instrumentId)
      setInstrumentId(null)
      reload()
    } catch (err) {
      setHoldingError(err instanceof Error ? err.message : 'Failed to add holding')
    }
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
          {holdingError && <p className="error-banner">{holdingError}</p>}
          <form className="inline-form form-section-gap" onSubmit={(e) => void handleAddHolding(e)}>
            <InstrumentPicker value={instrumentId} onChange={setInstrumentId} />
            <button type="submit" className="btn-primary" disabled={!instrumentId}>
              Open position
            </button>
          </form>
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
