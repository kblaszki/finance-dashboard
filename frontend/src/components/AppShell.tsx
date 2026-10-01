import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { ThemeToggle } from "./ThemeToggle";
import { CurrencySelect } from "./ui/CurrencySelect";
import { CurrencyProvider } from "../state/currency";
import { useAuth } from "../state/auth";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

function Icon(props: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {props.children}
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    end: true,
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </Icon>
    ),
  },
  {
    to: "/accounts",
    label: "Accounts",
    icon: (
      <Icon>
        <rect x="2.5" y="6" width="19" height="13" rx="2" />
        <path d="M2.5 10.5h19" />
        <path d="M6.5 15h4" />
      </Icon>
    ),
  },
  {
    to: "/categories",
    label: "Categories",
    icon: (
      <Icon>
        <path d="M3.5 6.5 10 3l6.5 3.5v6L10 16l-6.5-3.5v-6Z" transform="translate(2 3)" />
        <path d="M12 9.5v10" />
        <path d="M5.5 6.5 12 9.5l6.5-3" />
      </Icon>
    ),
  },
  {
    to: "/statistics",
    label: "Statistics",
    icon: (
      <Icon>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </Icon>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
      </Icon>
    ),
  },
];

function pageTitle(pathname: string): string {
  const item = NAV_ITEMS.find((nav) =>
    nav.end ? pathname === nav.to : pathname.startsWith(nav.to),
  );
  return item?.label ?? "Dashboard";
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const initial = (user?.username ?? user?.email ?? "?").slice(0, 1);

  return (
    <CurrencyProvider>
      <div className="shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <aside className="shell-sidebar">
          <p className="shell-brand">
            <span className="shell-brand-mark" aria-hidden>
              <Icon>
                <path d="M4 17 9.5 11l4 4L20 8" />
                <path d="M20 13V8h-5" />
              </Icon>
            </span>
            Finance Dashboard
          </p>
          <nav className="shell-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navLinkClass}
                end={item.end}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="shell-sidebar-footer">
            <div className="shell-user">
              <span className="shell-user-avatar" aria-hidden>
                {initial}
              </span>
              <span className="shell-user-meta">
                <span className="shell-user-name">
                  {user?.username ?? user?.email}
                </span>
                <span className="shell-user-email" title={user?.email ?? ""}>
                  {user?.email}
                </span>
              </span>
            </div>
            <div className="shell-sidebar-actions">
              <ThemeToggle />
              <button type="button" className="shell-logout" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
        </aside>
        <div className="shell-main">
          <header className="shell-topbar">
            <h1 className="shell-page-title">{pageTitle(pathname)}</h1>
            <div className="shell-topbar-actions">
              <CurrencySelect />
            </div>
          </header>
          <main className="shell-content" id="main-content">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
