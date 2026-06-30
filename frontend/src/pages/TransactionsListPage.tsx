import { useSearchParams } from 'react-router-dom'
import { AssetTradesTable } from '../components/AssetTradesTable'

export function TransactionsListPage() {
  const [params] = useSearchParams()
  const accountIdParam = params.get('accountId')
  const accountId = accountIdParam ? Number(accountIdParam) : undefined
  const validAccountId = accountId != null && Number.isFinite(accountId) && accountId > 0 ? accountId : undefined

  return (
    <div className="page">
      <h1 className="page-title">Asset trades</h1>
      <p className="muted page-lead">
        Buy and sell transactions for stocks, ETFs, and other brokerage holdings. Cash transfers and
        income are managed on each account page.
      </p>
      <AssetTradesTable accountId={validAccountId} />
    </div>
  )
}
