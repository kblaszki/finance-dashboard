import { NavLink, Outlet } from "react-router-dom";
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
          <ThemeToggle />
        </div>
        <nav className="app-nav">
          <NavLink to="/home" className={navLinkClass} end>
            Home
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
