import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAccount,
  fetchAccountValuations,
  type Account,
  type AccountValuationPoint,
} from '../api/accountsApi'
import { fetchHoldingLots, type HoldingLot } from '../api/holdingLotsApi'
import { fetchTransactions, type Transaction } from '../api/transactionsApi'
import { fetchHoldingValuations } from '../api/valuationsApi'
import { AccountBalanceChart } from '../components/AccountBalanceChart'
import { HoldingLotsTable } from '../components/HoldingLotsTable'
import { HoldingValuationChart } from '../components/HoldingValuationChart'
import { formatMoney } from '../utils/format'

type OpenPosition = {
  instrumentId: number
  label: string
}

function openPositionsFromLots(lots: HoldingLot[]): OpenPosition[] {
  const byInstrument = new Map<number, { symbol: string; name: string | null; qty: number }>()
  for (const lot of lots) {
    const symbol = lot.instrument?.symbol ?? `#${lot.instrumentId}`
    const name = lot.instrument?.name ?? null
    byInstrument.set(lot.instrumentId, {
      symbol,
      name,
      qty: lot.quantityAfter,
    })
  }
  return [...byInstrument.entries()]
    .filter(([, v]) => v.qty > 0)
    .map(([instrumentId, v]) => ({
      instrumentId,
      label: v.name ? `${v.symbol} — ${v.name}` : v.symbol,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function AccountDetailPage() {
  const { id } = useParams()
  const accountId = Number(id)
  const [account, setAccount] = useState<Account | null>(null)
  const [history, setHistory] = useState<AccountValuationPoint[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([])
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null)
  const [positionHistory, setPositionHistory] = useState<Awaited<ReturnType<typeof fetchHoldingValuations>>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) return
    void load()
  }, [accountId])

  useEffect(() => {
    if (!accountId || selectedInstrumentId == null) {
      setPositionHistory([])
      return
    }
    void fetchHoldingValuations(accountId, selectedInstrumentId)
      .then(setPositionHistory)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load position history'))
  }, [accountId, selectedInstrumentId])

  async function load() {
    setError(null)
    try {
      const acc = await fetchAccount(accountId)
      setAccount(acc)
      setHistory(await fetchAccountValuations(accountId))
      if (acc.accountType === 'BANK') {
        setTransactions(await fetchTransactions({ accountId }))
        setOpenPositions([])
        setSelectedInstrumentId(null)
      } else if (acc.accountType === 'BROKERAGE') {
        const lots = await fetchHoldingLots(accountId)
        const positions = openPositionsFromLots(lots)
        setOpenPositions(positions)
        setSelectedInstrumentId((current) => {
          if (current != null && positions.some((p) => p.instrumentId === current)) return current
          return positions[0]?.instrumentId ?? null
        })
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

  const selectedPosition = openPositions.find((p) => p.instrumentId === selectedInstrumentId)

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

      {account.accountType === 'BROKERAGE' && openPositions.length > 0 && (
        <section className="card">
          <h2>Position value history</h2>
          <label className="inline-form" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Instrument</span>
            <select
              value={selectedInstrumentId ?? ''}
              onChange={(e) => setSelectedInstrumentId(Number(e.target.value))}
            >
              {openPositions.map((p) => (
                <option key={p.instrumentId} value={p.instrumentId}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {selectedPosition && (
            <HoldingValuationChart points={positionHistory} currency={account.currency} />
          )}
        </section>
      )}

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
          <HoldingLotsTable accountId={accountId} currency={account.currency} onLotsChange={load} />
        )}
      </section>
    </div>
  )
}
