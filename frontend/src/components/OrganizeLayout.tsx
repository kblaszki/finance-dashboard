import { Outlet } from "react-router-dom";
import { HubTabs } from "./ui/HubTabs";

export function OrganizeLayout() {
  return (
    <div className="page-stack">
      <HubTabs
        ariaLabel="Organize sections"
        items={[
          {
            to: "/organize/categories",
            label: "Categories",
            match: "/organize/categories",
          },
          { to: "/organize/tags", label: "Tags", match: "/organize/tags" },
        ]}
      />
      <Outlet />
    </div>
  );
}
