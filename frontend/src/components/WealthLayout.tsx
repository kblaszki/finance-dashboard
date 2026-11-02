import { Outlet } from "react-router-dom";
import { HubTabs } from "./ui/HubTabs";

export function WealthLayout() {
  return (
    <div className="page-stack">
      <HubTabs
        ariaLabel="Wealth sections"
        items={[
          { to: "/accounts", label: "Accounts", match: "/accounts" },
          { to: "/markets", label: "Markets", match: "/markets" },
        ]}
      />
      <Outlet />
    </div>
  );
}
