import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAccounts, type Account } from '../api/accountsApi'
import { fetchInstruments, type Instrument } from '../api/instrumentsApi'
import {
  createCorporateAction,
  fetchCorporateActions,
  type CorporateAction,
  type CorporateActionType,
} from '../api/corporateActionsApi'
import {
  createPositionTransfer,
  fetchPositionTransfers,
  type PositionTransfer,
} from '../api/positionTransfersApi'
import {
  createIkzeContribution,
  createTaxWrapperWithdrawal,
  deleteIkzeContribution,
  deleteTaxWrapperWithdrawal,
  fetchIkzeContributions,
  fetchTaxWrapperWithdrawals,
  type IkzeContribution,
  type TaxWrapperWithdrawal,
  type WithdrawalType,
} from '../api/taxWrappersApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

const WITHDRAWAL_TYPES: WithdrawalType[] = ['partial', 'full', 'securities_transfer']
const ACTION_TYPES: CorporateActionType[] = ['stock_split', 'reverse_split', 'merger', 'spinoff']

export function TaxSettingsPage() {
  const { data: accounts } = useAsyncData(fetchAccounts)
  const { data: instruments } = useAsyncData(fetchInstruments)
  const {
    data: withdrawals,
    loading: wLoading,
    reload: reloadW,
  } = useAsyncData(fetchTaxWrapperWithdrawals)
  const {
    data: ikzeRows,
    loading: iLoading,
    reload: reloadI,
  } = useAsyncData(fetchIkzeContributions)
  const {
    data: transfers,
    loading: tLoading,
    reload: reloadT,
  } = useAsyncData(fetchPositionTransfers)
  const {
    data: actions,
    loading: aLoading,
    reload: reloadA,
  } = useAsyncData(fetchCorporateActions)

  const brokerageAccounts = (accounts ?? []).filter((a) => a.accountType === 'BROKERAGE')
  const ikzeAccounts = brokerageAccounts.filter((a) => a.taxWrapperType === 'ikze')

  const [wForm, setWForm] = useState({
    accountId: 0,
    amount: 0,
    currency: 'PLN',
    withdrawnOn: new Date().toISOString().slice(0, 10),
    withdrawalType: 'partial' as WithdrawalType,
    includeInPit38: true,
  })
  const [iForm, setIForm] = useState({
    accountId: 0,
    taxYear: new Date().getFullYear(),
    amount: 0,
    currency: 'PLN',
    contributedOn: new Date().toISOString().slice(0, 10),
  })
  const [tForm, setTForm] = useState({
    fromAccountId: 0,
    toAccountId: 0,
    instrumentId: 0,
    quantity: 0,
    transferDate: new Date().toISOString().slice(0, 10),
  })
  const [aForm, setAForm] = useState({
    accountId: 0,
    instrumentId: 0,
    actionType: 'stock_split' as CorporateActionType,
    actionDate: new Date().toISOString().slice(0, 10),
    ratio: 2,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (brokerageAccounts.length && !wForm.accountId) {
      const first = brokerageAccounts[0]
      setWForm((f) => ({ ...f, accountId: first.id, currency: first.currency }))
      setTForm((f) => ({
        ...f,
        fromAccountId: first.id,
        toAccountId: brokerageAccounts[1]?.id ?? first.id,
      }))
      setAForm((f) => ({ ...f, accountId: first.id }))
    }
    if (ikzeAccounts.length && !iForm.accountId) {
      const first = ikzeAccounts[0]
      setIForm((f) => ({ ...f, accountId: first.id, currency: first.currency }))
    }
    if (instruments?.length && !tForm.instrumentId) {
      setTForm((f) => ({ ...f, instrumentId: instruments[0].id }))
      setAForm((f) => ({ ...f, instrumentId: instruments[0].id }))
    }
  }, [brokerageAccounts, ikzeAccounts, instruments, wForm.accountId, iForm.accountId, tForm.instrumentId])

  async function handleWithdrawal(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createTaxWrapperWithdrawal(wForm)
      reloadW()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save withdrawal')
    }
  }

  async function handleIkze(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createIkzeContribution(iForm)
      reloadI()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save IKZE contribution')
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createPositionTransfer(tForm)
      reloadT()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer position')
    }
  }

  async function handleAction(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createCorporateAction({
        ...aForm,
        ratio: aForm.actionType === 'stock_split' || aForm.actionType === 'reverse_split' ? aForm.ratio : null,
      })
      reloadA()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record corporate action')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Tax settings</h1>
        <p className="muted">
          Wrapper withdrawals, IKZE contributions, position transfers, and corporate actions (FR-039–041).
        </p>
        <p>
          <Link to="/tax">← Back to tax report</Link>
        </p>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="card">
        <h2>Tax wrapper withdrawals</h2>
        <form className="form-grid" onSubmit={(e) => void handleWithdrawal(e)}>
          <AccountSelect
            accounts={brokerageAccounts}
            value={wForm.accountId}
            onChange={(id) => {
              const acc = brokerageAccounts.find((a) => a.id === id)
              setWForm((f) => ({ ...f, accountId: id, currency: acc?.currency ?? f.currency }))
            }}
          />
          <label>
            Date
            <input
              type="date"
              value={wForm.withdrawnOn}
              onChange={(e) => setWForm((f) => ({ ...f, withdrawnOn: e.target.value }))}
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min={0}
              step="0.01"
              value={wForm.amount || ''}
              onChange={(e) => setWForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            />
          </label>
          <label>
            Type
            <select
              value={wForm.withdrawalType}
              onChange={(e) =>
                setWForm((f) => ({ ...f, withdrawalType: e.target.value as WithdrawalType }))
              }
            >
              {WITHDRAWAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={wForm.includeInPit38}
              onChange={(e) => setWForm((f) => ({ ...f, includeInPit38: e.target.checked }))}
            />
            Include in PIT-38 for this year
          </label>
          <button type="submit" className="btn-primary">
            Add withdrawal
          </button>
        </form>
        {wLoading ? <p>Loading…</p> : <WithdrawalTable rows={withdrawals ?? []} onDelete={reloadW} />}
      </section>

      <section className="card">
        <h2>IKZE contributions</h2>
        {ikzeAccounts.length === 0 ? (
          <p className="muted">Set an account&apos;s wrapper type to IKZE on the account page first.</p>
        ) : (
          <>
            <form className="form-grid" onSubmit={(e) => void handleIkze(e)}>
              <AccountSelect
                accounts={ikzeAccounts}
                value={iForm.accountId}
                onChange={(id) => {
                  const acc = ikzeAccounts.find((a) => a.id === id)
                  setIForm((f) => ({ ...f, accountId: id, currency: acc?.currency ?? f.currency }))
                }}
              />
              <label>
                Tax year
                <input
                  type="number"
                  value={iForm.taxYear}
                  onChange={(e) => setIForm((f) => ({ ...f, taxYear: Number(e.target.value) }))}
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={iForm.amount || ''}
                  onChange={(e) => setIForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={iForm.contributedOn}
                  onChange={(e) => setIForm((f) => ({ ...f, contributedOn: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn-primary">
                Add contribution
              </button>
            </form>
            {iLoading ? <p>Loading…</p> : <IkzeTable rows={ikzeRows ?? []} onDelete={reloadI} />}
          </>
        )}
      </section>

      <section className="card">
        <h2>Position transfers</h2>
        <form className="form-grid" onSubmit={(e) => void handleTransfer(e)}>
          <AccountSelect
            label="From"
            accounts={brokerageAccounts}
            value={tForm.fromAccountId}
            onChange={(id) => setTForm((f) => ({ ...f, fromAccountId: id }))}
          />
          <AccountSelect
            label="To"
            accounts={brokerageAccounts}
            value={tForm.toAccountId}
            onChange={(id) => setTForm((f) => ({ ...f, toAccountId: id }))}
          />
          <InstrumentSelect
            instruments={instruments ?? []}
            value={tForm.instrumentId}
            onChange={(id) => setTForm((f) => ({ ...f, instrumentId: id }))}
          />
          <label>
            Quantity
            <input
              type="number"
              min={0}
              step="0.0001"
              value={tForm.quantity || ''}
              onChange={(e) => setTForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={tForm.transferDate}
              onChange={(e) => setTForm((f) => ({ ...f, transferDate: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn-primary">
            Transfer
          </button>
        </form>
        {tLoading ? <p>Loading…</p> : <TransferTable rows={transfers ?? []} />}
      </section>

      <section className="card">
        <h2>Corporate actions</h2>
        <form className="form-grid" onSubmit={(e) => void handleAction(e)}>
          <AccountSelect
            accounts={brokerageAccounts}
            value={aForm.accountId}
            onChange={(id) => setAForm((f) => ({ ...f, accountId: id }))}
          />
          <InstrumentSelect
            instruments={instruments ?? []}
            value={aForm.instrumentId}
            onChange={(id) => setAForm((f) => ({ ...f, instrumentId: id }))}
          />
          <label>
            Action
            <select
              value={aForm.actionType}
              onChange={(e) =>
                setAForm((f) => ({ ...f, actionType: e.target.value as CorporateActionType }))
              }
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {(aForm.actionType === 'stock_split' || aForm.actionType === 'reverse_split') && (
            <label>
              Ratio
              <input
                type="number"
                min={0.0001}
                step="0.01"
                value={aForm.ratio}
                onChange={(e) => setAForm((f) => ({ ...f, ratio: Number(e.target.value) }))}
              />
            </label>
          )}
          <label>
            Date
            <input
              type="date"
              value={aForm.actionDate}
              onChange={(e) => setAForm((f) => ({ ...f, actionDate: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn-primary">
            Record action
          </button>
        </form>
        {aLoading ? <p>Loading…</p> : <ActionTable rows={actions ?? []} />}
      </section>
    </div>
  )
}

function AccountSelect(props: {
  label?: string
  accounts: Account[]
  value: number
  onChange: (id: number) => void
}) {
  return (
    <label>
      {props.label ?? 'Account'}
      <select value={props.value || ''} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.taxWrapperType})
          </option>
        ))}
      </select>
    </label>
  )
}

function InstrumentSelect(props: {
  instruments: Instrument[]
  value: number
  onChange: (id: number) => void
}) {
  return (
    <label>
      Instrument
      <select value={props.value || ''} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.instruments.map((i) => (
          <option key={i.id} value={i.id}>
            {i.symbol}
          </option>
        ))}
      </select>
    </label>
  )
}

function WithdrawalTable(props: { rows: TaxWrapperWithdrawal[]; onDelete: () => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Account</th>
          <th>Amount</th>
          <th>Type</th>
          <th>PIT-38</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.id}>
            <td>{row.withdrawnOn.slice(0, 10)}</td>
            <td>{row.accountName}</td>
            <td>{formatMoney(row.amount, row.currency)}</td>
            <td>{row.withdrawalType}</td>
            <td>{row.includeInPit38 ? 'yes' : 'no'}</td>
            <td>
              <button
                type="button"
                className="btn-link"
                onClick={() => void deleteTaxWrapperWithdrawal(row.id).then(props.onDelete)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function IkzeTable(props: { rows: IkzeContribution[]; onDelete: () => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Year</th>
          <th>Account</th>
          <th>Amount</th>
          <th>Date</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.id}>
            <td>{row.taxYear}</td>
            <td>{row.accountName}</td>
            <td>{formatMoney(row.amount, row.currency)}</td>
            <td>{row.contributedOn.slice(0, 10)}</td>
            <td>
              <button
                type="button"
                className="btn-link"
                onClick={() => void deleteIkzeContribution(row.id).then(props.onDelete)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TransferTable(props: { rows: PositionTransfer[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>From</th>
          <th>To</th>
          <th>Symbol</th>
          <th>Qty</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.id}>
            <td>{row.transferDate.slice(0, 10)}</td>
            <td>{row.fromAccountName}</td>
            <td>{row.toAccountName}</td>
            <td>{row.symbol}</td>
            <td>{row.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ActionTable(props: { rows: CorporateAction[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Account</th>
          <th>Symbol</th>
          <th>Action</th>
          <th>Ratio</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.id}>
            <td>{row.actionDate.slice(0, 10)}</td>
            <td>{row.accountName}</td>
            <td>{row.symbol}</td>
            <td>{row.actionType}</td>
            <td>{row.ratio ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
