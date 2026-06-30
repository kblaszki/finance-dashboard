import { useCallback, useMemo, useState } from 'react'
import { fetchAssetTrades, type AssetTrade } from '../api/assetTradesApi'
import { fetchInternalTransfers, type InternalTransfer } from '../api/internalTransfersApi'
import { fetchTransactions, type Transaction } from '../api/transactionsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatMoney } from '../utils/format'

type Props = {
  accountId: number
  accountCurrency: string
}

type ActivityKind = 'CASH' | 'TRADE' | 'TRANSFER'

type ActivityRow = {
  key: string
  date: string
  kind: ActivityKind
  label: string
  amount: number
  currency: string
  detail: string
}

function instrumentLabel(trade: AssetTrade): string {
  const inst = trade.instrument
  if (!inst) return 'Asset trade'
  return inst.name ? `${inst.symbol} — ${inst.name}` : inst.symbol
}

function cashLabel(tx: Transaction): string {
  return tx.category || tx.transactionType
}

function transferLabel(transfer: InternalTransfer, accountId: number): string {
  if (transfer.fromAccountId === accountId) {
    return `Transfer to ${transfer.toAccountName}`
  }
  return `Transfer from ${transfer.fromAccountName}`
}

function transferAmount(transfer: InternalTransfer, accountId: number): number {
  return transfer.fromAccountId === accountId ? transfer.fromAmount : transfer.toAmount
}

function transferCurrency(transfer: InternalTransfer, accountId: number): string {
  return transfer.fromAccountId === accountId ? transfer.fromCurrency : transfer.toCurrency
}

function buildActivityRows(
  accountId: number,
  transactions: Transaction[],
  trades: AssetTrade[],
  transfers: InternalTransfer[],
): ActivityRow[] {
  const rows: ActivityRow[] = []

  for (const tx of transactions) {
    if (tx.category === 'INTERNAL_TRANSFER') continue
    rows.push({
      key: `cash-${tx.id}`,
      date: tx.date,
      kind: 'CASH',
      label: cashLabel(tx),
      amount: tx.amount,
      currency: tx.currency,
      detail: tx.transactionType,
    })
  }

  for (const trade of trades) {
    rows.push({
      key: `trade-${trade.id}`,
      date: trade.tradeDate,
      kind: 'TRADE',
      label: instrumentLabel(trade),
      amount: trade.totalPrice ?? 0,
      currency: trade.currency,
      detail: `${trade.side} · ${trade.quantity} @ ${trade.pricePerUnit ?? '—'}`,
    })
  }

  for (const transfer of transfers) {
    rows.push({
      key: `transfer-${transfer.groupId}`,
      date: transfer.date,
      kind: 'TRANSFER',
      label: transferLabel(transfer, accountId),
      amount: transferAmount(transfer, accountId),
      currency: transferCurrency(transfer, accountId),
      detail:
        transfer.fromCurrency === transfer.toCurrency
          ? 'Internal transfer'
          : `FX ${transfer.exchangeRate}${transfer.commission ? ` · fee ${transfer.commission}` : ''}`,
    })
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function AccountActivityTable({ accountId, accountCurrency }: Props) {
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const loader = useCallback(async () => {
    const query = {
      accountId,
      ...(filterFrom ? { from: filterFrom } : {}),
      ...(filterTo ? { to: filterTo } : {}),
    }
    const [transactions, trades, transferResult] = await Promise.all([
      fetchTransactions(query),
      fetchAssetTrades(query),
      fetchInternalTransfers(query),
    ])
    return buildActivityRows(accountId, transactions, trades, transferResult.transfers)
  }, [accountId, filterFrom, filterTo])

  const { data: rows, error, loading } = useAsyncData(loader)
  const activityRows = useMemo(() => rows ?? [], [rows])

  return (
    <div className="page-stack">
      <section className="card">
        <h2>Filters</h2>
        <div className="inline-form">
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
      </section>

      <section className="card">
        <h2>Account activity ({loading ? '…' : activityRows.length})</h2>
        {error && <p className="error-banner">{error}</p>}
        {loading && !rows ? (
          <p className="muted">Loading activity…</p>
        ) : activityRows.length === 0 ? (
          <p className="muted">No activity matches the current filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Detail</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((row) => (
                  <tr key={row.key}>
                    <td>{new Date(row.date).toLocaleDateString('en-US')}</td>
                    <td>{row.kind}</td>
                    <td>{row.label}</td>
                    <td className="muted">{row.detail}</td>
                    <td>{formatMoney(row.amount, row.currency || accountCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
