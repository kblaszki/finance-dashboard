import { useCallback } from 'react'
import { fetchBudgetAlerts } from '../api/budgetsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from '../state/currency'
import { formatMoney } from '../utils/format'

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function BudgetAlertsBanner() {
  const { currency } = useCurrency()
  const month = currentMonthKey()
  const loader = useCallback(() => fetchBudgetAlerts(month, currency), [month, currency])
  const { data: alerts } = useAsyncData(loader)

  if (!alerts?.length) return null

  return (
    <section className="card">
      <h2>Budget alerts</h2>
      <ul className="stack-md">
        {alerts.map((alert) => (
          <li
            key={`${alert.categoryId}-${alert.threshold}`}
            className={alert.severity === 'exceeded' ? 'error-banner' : 'muted'}
          >
            <strong>{alert.categoryName}</strong>: {alert.pctUsed.toFixed(0)}% of budget (
            {formatMoney(alert.spent, alert.currency)} / {formatMoney(alert.budgetAmount, alert.currency)}
            ) — {alert.threshold}% threshold
          </li>
        ))}
      </ul>
    </section>
  )
}
