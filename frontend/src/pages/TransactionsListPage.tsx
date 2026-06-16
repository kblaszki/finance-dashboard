import { TransactionTable } from '../components/TransactionTable'

export function TransactionsListPage() {
  return (
    <div className="page">
      <h1 className="page-title">Transactions</h1>
      <TransactionTable />
    </div>
  )
}
