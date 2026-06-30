import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAccounts, type Account } from '../api/accountsApi'
import { isHoldingsAccountType } from '../state/accountTypes'
import {
  createAssetTrade,
  fetchAssetTrades,
  type AssetTrade,
} from '../api/assetTradesApi'
import { deleteHoldingLot } from '../api/holdingLotsApi'
import { fetchInstruments, type Instrument } from '../api/instrumentsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type Props = {
  accountId?: number
}

function instrumentLabel(inst: { symbol: string; name: string | null }): string {
  return inst.name ? `${inst.symbol} — ${inst.name}` : inst.symbol
}

export function AssetTradesTable({ accountId: fixedAccountId }: Props) {
  const { data: accounts, error: accountsError } = useAsyncData(fetchAccounts)
  const brokerageAccounts = useMemo(
    () => (accounts ?? []).filter((a: Account) => isHoldingsAccountType(a.accountType)),
    [accounts],
  )

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAccountId, setFilterAccountId] = useState(
    fixedAccountId ? String(fixedAccountId) : '',
  )
  const [filterInstrumentId, setFilterInstrumentId] = useState('')

  const [formAccountId, setFormAccountId] = useState(fixedAccountId ?? 0)
  const [instrumentQuery, setInstrumentQuery] = useState('')
  const [instrumentOptions, setInstrumentOptions] = useState<Instrument[]>([])
  const [instrumentId, setInstrumentId] = useState<number | ''>('')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState(1)
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [commission, setCommission] = useState(0)
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10))
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (fixedAccountId) {
      setFilterAccountId(String(fixedAccountId))
      setFormAccountId(fixedAccountId)
    }
  }, [fixedAccountId])

  useEffect(() => {
    if (!formAccountId && brokerageAccounts.length > 0) {
      setFormAccountId(brokerageAccounts[0].id)
    }
  }, [brokerageAccounts, formAccountId])

  useEffect(() => {
    const q = instrumentQuery.trim()
    if (q.length < 1) {
      setInstrumentOptions([])
      return
    }
    let cancelled = false
    void fetchInstruments(q)
      .then((rows) => {
        if (!cancelled) setInstrumentOptions(rows.slice(0, 20))
      })
      .catch(() => {
        if (!cancelled) setInstrumentOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [instrumentQuery])

  const selectedInstrument = instrumentOptions.find((i) => i.id === instrumentId)

  const tradesLoader = useCallback(() => {
    const accountId =
      filterAccountId && Number.isFinite(Number(filterAccountId))
        ? Number(filterAccountId)
        : undefined
    const instrumentIdFilter =
      filterInstrumentId && Number.isFinite(Number(filterInstrumentId))
        ? Number(filterInstrumentId)
        : undefined
    return fetchAssetTrades({
      from: filterFrom || undefined,
      to: filterTo || undefined,
      accountId,
      instrumentId: instrumentIdFilter,
    })
  }, [filterAccountId, filterFrom, filterInstrumentId, filterTo])

  const {
    data: trades,
    error: tradesError,
    loading,
    reload,
  } = useAsyncData(tradesLoader)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!formAccountId || formAccountId < 1) {
      setFormError('Select a brokerage account')
      return
    }
    if (instrumentId === '') {
      setFormError('Select an instrument')
      return
    }
    const inst = selectedInstrument ?? instrumentOptions.find((i) => i.id === instrumentId)
    try {
      await createAssetTrade({
        accountId: formAccountId,
        instrumentId: Number(instrumentId),
        side,
        quantity,
        pricePerUnit,
        commission,
        currency: inst?.currency ?? 'PLN',
        tradeDate: new Date(tradeDate).toISOString(),
      })
      reload()
      setQuantity(1)
      setPricePerUnit(0)
      setCommission(0)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save trade')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this trade?')) return
    setFormError(null)
    try {
      await deleteHoldingLot(id)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const rows = trades ?? []
  const bannerError = formError ?? tradesError ?? accountsError

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
              <option value="">All brokerage</option>
              {brokerageAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Instrument ID
          <input
            type="number"
            min={1}
            placeholder="Optional"
            value={filterInstrumentId}
            onChange={(e) => setFilterInstrumentId(e.target.value)}
          />
        </label>
      </div>

      <form className="card inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <h2 className="section-title">Add buy / sell</h2>
        {!fixedAccountId && (
          <select
            value={formAccountId || ''}
            onChange={(e) => setFormAccountId(Number(e.target.value))}
          >
            {brokerageAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          placeholder="Search instrument symbol"
          value={instrumentQuery}
          onChange={(e) => {
            setInstrumentQuery(e.target.value)
            setInstrumentId('')
          }}
        />
        <select
          value={instrumentId === '' ? '' : String(instrumentId)}
          onChange={(e) => setInstrumentId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select instrument</option>
          {instrumentOptions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {instrumentLabel(inst)} ({inst.currency})
            </option>
          ))}
        </select>
        <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
        <input
          type="number"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          placeholder="Quantity"
        />
        <input
          type="number"
          step="any"
          min="0"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(Number(e.target.value))}
          placeholder="Price per unit"
        />
        <input
          type="number"
          step="any"
          min="0"
          value={commission}
          onChange={(e) => setCommission(Number(e.target.value))}
          placeholder="Commission"
        />
        <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
        <button type="submit" className="btn-primary">
          Save trade
        </button>
      </form>

      {fixedAccountId && (
        <p className="muted">
          <Link to="/transactions">All asset trades</Link>
          {' · '}
          Cash income and expenses are on the{' '}
          <Link to={`/accounts/${fixedAccountId}`}>account page</Link>.
        </p>
      )}

      {loading && !trades ? (
        <p className="muted">Loading trades…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No buy/sell trades match the current filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {!fixedAccountId && <th>Account</th>}
                <th>Instrument</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Gross</th>
                <th>Commission</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t: AssetTrade) => (
                <tr key={t.id}>
                  <td>{new Date(t.tradeDate).toLocaleDateString('en-US')}</td>
                  {!fixedAccountId && <td>{t.accountName ?? '—'}</td>}
                  <td>
                    {t.instrument ? (
                      <Link to={`/accounts/${t.accountId}/assets/${t.instrumentId}`}>
                        {instrumentLabel(t.instrument)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{t.side}</td>
                  <td>{t.quantity}</td>
                  <td>{formatMoney(t.totalPrice ?? t.pricePerUnit ?? 0, t.currency)}</td>
                  <td>{formatMoney(t.commission ?? 0, t.currency)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => void handleDelete(t.id)}
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
