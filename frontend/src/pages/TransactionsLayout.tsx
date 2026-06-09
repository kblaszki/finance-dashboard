import { Outlet } from 'react-router-dom'
import { TransactionsSubNav } from '../components/TransactionsSubNav'

export function TransactionsLayout() {
  return (
    <div className="page">
      <h1 className="page-title">Transactions</h1>
      <TransactionsSubNav />
      <Outlet />
    </div>
  )
}
