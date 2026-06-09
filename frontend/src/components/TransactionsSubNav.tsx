import { NavLink } from 'react-router-dom'

function subNavClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'active transactions-subnav-link' : 'transactions-subnav-link'
}

export function TransactionsSubNav() {
  return (
    <nav className="transactions-subnav" aria-label="Transaction sections">
      <NavLink to="/transactions" end className={subNavClass}>
        List
      </NavLink>
      <NavLink to="/transactions/categories" className={subNavClass}>
        Categories
      </NavLink>
      <NavLink to="/transactions/import" className={subNavClass}>
        Import CSV
      </NavLink>
    </nav>
  )
}
