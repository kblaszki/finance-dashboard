import { NavLink } from 'react-router-dom'

function subNavClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'active transactions-subnav-link' : 'transactions-subnav-link'
}

export function TransactionsSubNav() {
  return (
    <nav className="transactions-subnav" aria-label="Sekcje transakcji">
      <NavLink to="/transactions" end className={subNavClass}>
        Lista
      </NavLink>
      <NavLink to="/transactions/categories" className={subNavClass}>
        Kategorie
      </NavLink>
      <NavLink to="/transactions/import" className={subNavClass}>
        Import CSV
      </NavLink>
    </nav>
  )
}
