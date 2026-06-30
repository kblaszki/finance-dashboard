import { NavLink, Outlet } from "react-router-dom";
import { CurrencySelect } from "./CurrencySelect";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../state/auth";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-root">
      <aside className="app-sidebar">
        <h1 className="app-logo">Finance Dashboard</h1>
        <div className="sidebar-user">
          <span className="sidebar-user-email" title={user?.email ?? ""}>
            {user?.username ?? user?.email}
          </span>
          <button type="button" className="theme-toggle" onClick={logout}>
            Log out
          </button>
        </div>
        <div className="sidebar-controls">
          <CurrencySelect />
          <ThemeToggle />
        </div>
        <nav className="app-nav">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/statistics" className={navLinkClass}>
            Statistics
          </NavLink>
          <NavLink to="/portfolio" className={navLinkClass}>
            Portfolio
          </NavLink>
          <NavLink to="/accounts" className={navLinkClass}>
            Accounts
          </NavLink>
          <NavLink to="/transactions" className={navLinkClass}>
            Transactions
          </NavLink>
          <NavLink to="/categories" className={navLinkClass}>
            Categories
          </NavLink>
          <NavLink to="/budgets" className={navLinkClass}>
            Budgets
          </NavLink>
          <NavLink to="/import" className={navLinkClass}>
            Import
          </NavLink>
          <NavLink to="/income-events" className={navLinkClass}>
            Income
          </NavLink>
          <NavLink to="/transfers" className={navLinkClass}>
            Transfers
          </NavLink>
          <NavLink to="/tax" className={navLinkClass}>
            Tax (PL)
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
