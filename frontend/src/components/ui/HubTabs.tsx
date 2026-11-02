import { NavLink, useLocation } from "react-router-dom";

export type HubTabItem = {
  to: string;
  label: string;
  /** Path prefix that keeps this tab selected (defaults to `to`). */
  match?: string;
};

function pathMatches(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`);
}

export function HubTabs(props: {
  ariaLabel: string;
  items: HubTabItem[];
}) {
  const { ariaLabel, items } = props;
  const { pathname } = useLocation();

  return (
    <nav className="hub-tabs" aria-label={ariaLabel}>
      {items.map((item) => {
        const match = item.match ?? item.to;
        const selected = pathMatches(pathname, match);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={
              selected
                ? "hub-tabs__btn hub-tabs__btn--active"
                : "hub-tabs__btn"
            }
            aria-current={selected ? "page" : undefined}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
