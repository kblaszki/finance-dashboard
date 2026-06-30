import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAccount,
  fetchAccountValuations,
  updateAccount,
  type Account,
  type AccountValuationPoint,
} from '../api/accountsApi'
import { createHolding, fetchAccountHoldings, type AccountHoldings } from '../api/holdingsApi'
import {
  isHoldingsAccountType,
  isRevalueAccountType,
  showBrokerageChartSplit,
} from '../state/accountTypes'
import { AccountActivityTable } from '../components/AccountActivityTable'
import { AccountBalanceChart } from '../components/AccountBalanceChart'
import { AccountHoldingsTable } from '../components/AccountHoldingsTable'
import { AccountStatsCards } from '../components/AccountStatsCards'
import { BrokerImportForm } from '../components/BrokerImportForm'
import { InstrumentPicker } from '../components/InstrumentPicker'
import { ManualAccountRevalueForm } from '../components/ManualAccountRevalueForm'
import { MarketPricesStatus } from '../components/MarketPricesStatus'
import { TransactionTable } from '../components/TransactionTable'
import { useAsyncData } from '../hooks/useAsyncData'
import { rangeForPreset } from '../state/period'
import { formatMoney } from '../utils/format'

type AccountDetailData = {
  account: Account
  history: AccountValuationPoint[]
  holdings: AccountHoldings
}

const defaultChartRange = rangeForPreset('last_12_months')

async function loadAccountDetail(
  accountId: number,
  chartFrom: string,
  chartTo: string,
): Promise<AccountDetailData> {
  const account = await fetchAccount(accountId)
  const history = await fetchAccountValuations(accountId, chartFrom, chartTo)
  const holdings =
    isHoldingsAccountType(account.accountType)
      ? await fetchAccountHoldings(accountId)
      : { open: [], closed: [] }
  return { account, history, holdings }
}

export function AccountDetailPage() {
  const { id } = useParams()
  const accountId = Number(id)
  const invalidId = !Number.isFinite(accountId) || accountId < 1
  const [chartFrom, setChartFrom] = useState(defaultChartRange.from)
  const [chartTo, setChartTo] = useState(defaultChartRange.to)
  const loader = useCallback(async () => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      throw new Error('Invalid account ID')
    }
    return loadAccountDetail(accountId, chartFrom, chartTo)
  }, [accountId, chartFrom, chartTo])
  const { data, error, loading, reload } = useAsyncData(loader)
  const [instrumentId, setInstrumentId] = useState<number | null>(null)
  const [holdingError, setHoldingError] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState(false)

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

  function startEditAccount() {
    setEditName(account.name)
    setEditDescription(account.description ?? '')
    setEditError(null)
    setEditingAccount(true)
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    try {
      await updateAccount(accountId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      })
      setEditingAccount(false)
      reload()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update account')
    }
  }

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

  const isHoldings = isHoldingsAccountType(account.accountType)
  const showTransactions = account.accountType === 'BANK' || isHoldings

  return (
    <div className="page">
      <p>
        <Link to="/accounts" className="page-back-link">← Accounts</Link>
      </p>
      <h1 className="page-title">{account.name}</h1>
      <p className="muted">
        {account.accountType} · Cash {formatMoney(account.cashBalance, account.currency)}
      </p>

      {isHoldings && (
        <MarketPricesStatus onSynced={reload} />
      )}

      <section className="card">
        <h2>Account details</h2>
        {editError && <p className="error-banner">{editError}</p>}
        {editingAccount ? (
          <form className="inline-form" onSubmit={(e) => void handleSaveAccount(e)}>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" required />
            <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" />
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" className="btn-link" onClick={() => setEditingAccount(false)}>Cancel</button>
          </form>
        ) : (
          <div>
            {account.description && <p className="muted">{account.description}</p>}
            <button type="button" className="btn-link" onClick={startEditAccount}>Edit account</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Account value history</h2>
        <div className="inline-form form-section-gap">
          <input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} />
          <input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} />
        </div>
        <AccountBalanceChart
          points={history}
          currency={account.currency}
          showComponents={showBrokerageChartSplit(account.accountType)}
        />
      </section>

      <section className="card">
        <h2>Statistics</h2>
        <AccountStatsCards accountId={accountId} accountType={account.accountType} />
      </section>

      {isRevalueAccountType(account.accountType) && (
        <section className="card">
          <h2>Update estimated value</h2>
          <p className="muted">Revalue this asset (e.g. property estimate) without a regular income/expense entry.</p>
          <ManualAccountRevalueForm
            accountId={accountId}
            currentValue={account.cashBalance}
            currency={account.currency}
            onSaved={reload}
          />
        </section>
      )}

      {isHoldings && account.accountType === 'BROKERAGE' && (
        <section className="card">
          <h2>Import trades</h2>
          <BrokerImportForm accountId={accountId} onImported={reload} />
        </section>
      )}

      {isHoldings && (
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

      {showTransactions && isHoldings && (
        <>
          <AccountActivityTable accountId={accountId} accountCurrency={account.currency} />
          <TransactionTable
            accountId={accountId}
            accountCurrency={account.currency}
            accountType={account.accountType}
            showFilters={false}
            showAccountColumn={false}
            hideList
            title="Add cash transaction"
          />
        </>
      )}

      {showTransactions && account.accountType === 'BANK' && (
        <TransactionTable
          accountId={accountId}
          accountCurrency={account.currency}
          accountType={account.accountType}
          showFilters
          showBankCashFilters
          groupByCategory
          showAccountColumn={false}
          title="Cash transactions"
        />
      )}
    </div>
  )
}
