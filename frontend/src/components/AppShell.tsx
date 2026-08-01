import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../state/auth";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-folio">
      <div className="app-folio-atmos" aria-hidden />
      <aside className="app-folio-mast">
        <p className="app-folio-brand">Finance Dashboard</p>
        <nav className="app-nav">
          <NavLink to="/home" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/accounts" className={navLinkClass}>
            Accounts
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </nav>
        <div className="app-folio-user">
          <span className="app-folio-user-name" title={user?.email ?? ""}>
            {user?.username ?? user?.email}
          </span>
          <button type="button" className="app-folio-logout" onClick={logout}>
            Log out
          </button>
        </div>
        <div className="app-folio-controls">
          <ThemeToggle />
        </div>
        <p className="app-folio-mast-note muted">
          Private workspace — bank accounts and settings today; more portfolio
          tools follow the roadmap.
        </p>
      </aside>
      <main className="app-folio-page">
        <Outlet />
      </main>
    </div>
  );
}
