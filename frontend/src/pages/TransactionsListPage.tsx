import { useSearchParams } from 'react-router-dom'
import { TransactionTable } from '../components/TransactionTable'

export function TransactionsListPage() {
  const [params] = useSearchParams()
  const accountIdParam = params.get('accountId')
  const accountId = accountIdParam ? Number(accountIdParam) : undefined
  const validAccountId = accountId != null && Number.isFinite(accountId) && accountId > 0 ? accountId : undefined

  return (
    <div className="page">
      <h1 className="page-title">Transactions</h1>
      <TransactionTable accountId={validAccountId} showAccountColumn={!validAccountId} />
    </div>
  )
}
