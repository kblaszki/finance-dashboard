import { useSearchParams } from 'react-router-dom'
import { InternalTransfersTable } from '../components/InternalTransfersTable'

export function TransfersPage() {
  const [params] = useSearchParams()
  const accountIdParam = params.get('accountId')
  const accountId = accountIdParam ? Number(accountIdParam) : undefined
  const validAccountId = accountId != null && Number.isFinite(accountId) && accountId > 0 ? accountId : undefined

  return (
    <div className="page">
      <h1 className="page-title">Internal transfers</h1>
      <p className="muted page-lead">
        Move cash between your accounts. Cross-currency transfers support exchange rate and commission.
        Transfers are excluded from income and expense statistics.
      </p>
      <InternalTransfersTable accountId={validAccountId} />
    </div>
  )
}
