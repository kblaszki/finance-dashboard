import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAccounts, type Account } from '../api/accountsApi'
import {
  createInternalTransfer,
  deleteInternalTransfer,
  fetchInternalTransferFxSuggestion,
  fetchInternalTransfers,
  type InternalTransfer,
} from '../api/internalTransfersApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type Props = {
  accountId?: number
}

export function InternalTransfersTable({ accountId: fixedAccountId }: Props) {
  const { data: accounts, error: accountsError } = useAsyncData(fetchAccounts)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAccountId, setFilterAccountId] = useState(
    fixedAccountId ? String(fixedAccountId) : '',
  )

  const [fromAccountId, setFromAccountId] = useState<number | ''>('')
  const [toAccountId, setToAccountId] = useState<number | ''>('')
  const [fromAmount, setFromAmount] = useState(100)
  const [toAmount, setToAmount] = useState(100)
  const [exchangeRate, setExchangeRate] = useState<number | ''>('')
  const [commission, setCommission] = useState(0)
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const accountList = accounts ?? []
  const fromAccount = accountList.find((a) => a.id === fromAccountId)
  const toAccount = accountList.find((a) => a.id === toAccountId)
  const crossCurrency = Boolean(
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency,
  )

  useEffect(() => {
    if (fixedAccountId) setFilterAccountId(String(fixedAccountId))
  }, [fixedAccountId])

  useEffect(() => {
    if (!fromAccountId && accountList.length > 0) {
      setFromAccountId(accountList[0].id)
    }
  }, [accountList, fromAccountId])

  useEffect(() => {
    if (!crossCurrency || !fromAccount || !toAccount || fromAmount <= 0) return
    let cancelled = false
    void fetchInternalTransferFxSuggestion({
      fromCurrency: fromAccount.currency,
      toCurrency: toAccount.currency,
      fromAmount,
    })
      .then((suggestion) => {
        if (cancelled) return
        setExchangeRate(suggestion.exchangeRate)
        setToAmount(Number(suggestion.suggestedToAmount.toFixed(2)))
      })
      .catch(() => {
        if (!cancelled) setExchangeRate('')
      })
    return () => {
      cancelled = true
    }
  }, [crossCurrency, fromAccount, toAccount, fromAmount])

  useEffect(() => {
    if (!crossCurrency && fromAccount && toAccount) {
      setToAmount(fromAmount)
      setExchangeRate('')
      setCommission(0)
    }
  }, [crossCurrency, fromAmount, fromAccount, toAccount])

  const transfersLoader = useCallback(() => {
    const accountId =
      filterAccountId && Number.isFinite(Number(filterAccountId))
        ? Number(filterAccountId)
        : undefined
    return fetchInternalTransfers({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      accountId,
    }).then((res) => res.transfers)
  }, [filterAccountId, filterFrom, filterTo])

  const {
    data: transfers,
    error: transfersError,
    loading,
    reload,
  } = useAsyncData(transfersLoader)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (fromAccountId === '' || toAccountId === '') {
      setFormError('Select source and destination accounts')
      return
    }
    if (fromAccountId === toAccountId) {
      setFormError('Choose two different accounts')
      return
    }
    try {
      await createInternalTransfer({
        fromAccountId: Number(fromAccountId),
        toAccountId: Number(toAccountId),
        fromAmount,
        toAmount: crossCurrency ? toAmount : fromAmount,
        exchangeRate: crossCurrency && exchangeRate !== '' ? Number(exchangeRate) : undefined,
        commission: crossCurrency ? commission : commission || 0,
        date: new Date(transferDate).toISOString(),
        note: note.trim() || undefined,
      })
      reload()
      setNote('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save transfer')
    }
  }

  async function handleDelete(groupId: string) {
    if (!confirm('Delete this transfer?')) return
    setFormError(null)
    try {
      await deleteInternalTransfer(groupId)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete transfer')
    }
  }

  const rows = transfers ?? []
  const bannerError = formError ?? transfersError ?? accountsError
  const destinationOptions = useMemo(
    () => accountList.filter((a: Account) => a.id !== fromAccountId),
    [accountList, fromAccountId],
  )

  return (
    <div>
      {bannerError && <p className="error-banner">{bannerError}</p>}

      <div className="card inline-form form-section-gap filters-row">
        <label>
          From
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </label>
        {!fixedAccountId && (
          <label>
            Account
            <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accountList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <form className="card inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <h2 className="section-title">New internal transfer</h2>
        <select
          value={fromAccountId === '' ? '' : String(fromAccountId)}
          onChange={(e) => setFromAccountId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">From account</option>
          {accountList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
        <select
          value={toAccountId === '' ? '' : String(toAccountId)}
          onChange={(e) => setToAccountId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">To account</option>
          {destinationOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
        <input
          type="number"
          step="any"
          min="0"
          value={fromAmount}
          onChange={(e) => setFromAmount(Number(e.target.value))}
          placeholder="From amount"
        />
        {crossCurrency ? (
          <>
            <input
              type="number"
              step="any"
              min="0"
              value={exchangeRate === '' ? '' : exchangeRate}
              onChange={(e) =>
                setExchangeRate(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="Exchange rate"
            />
            <input
              type="number"
              step="any"
              min="0"
              value={toAmount}
              onChange={(e) => setToAmount(Number(e.target.value))}
              placeholder="To amount"
            />
            <input
              type="number"
              step="any"
              min="0"
              value={commission}
              onChange={(e) => setCommission(Number(e.target.value))}
              placeholder="Commission (from currency)"
            />
          </>
        ) : (
          <input
            type="number"
            step="any"
            min="0"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
            placeholder="Commission (optional)"
          />
        )}
        <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
        />
        <button type="submit" className="btn-primary">
          Save transfer
        </button>
      </form>

      {loading && !transfers ? (
        <p className="muted">Loading transfers…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No internal transfers match the current filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Sent</th>
                <th>Received</th>
                <th>Fee</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t: InternalTransfer) => (
                <tr key={t.groupId}>
                  <td>{new Date(t.date).toLocaleDateString('en-US')}</td>
                  <td>{t.fromAccountName}</td>
                  <td>{t.toAccountName}</td>
                  <td>{formatMoney(t.fromAmount, t.fromCurrency)}</td>
                  <td>{formatMoney(t.toAmount, t.toCurrency)}</td>
                  <td>{formatMoney(t.commission, t.fromCurrency)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => void handleDelete(t.groupId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
