import { useState } from "react";
import "../admin/admin.css";
import "./orgAdmin.css";
import { AdminHeader } from "./OrgAdminHeader";
import { AdminSidebar } from "./OrgAdminSidebar";
import { AdminProfileMenu } from "../admin/AdminProfileMenu";
import {
  NotificationsBell,
  NotificationsProvider,
} from "../admin/components/notifications/Notifications";
import { EmployeeSummary } from "./panels/EmployeeSummary";
import { HRDashboard } from "./panels/HRDashboard";
import { OrgOverview } from "./panels/OrgOverview";

interface OrgAdminPanelProps {
  organizationId?: string | null;
  createdBy?: string | null;
  userName?: string | null;
  onExit?: () => void;
  onSignOut?: () => void;
}

function OrgAdminPanel({
  organizationId,
  createdBy,
  userName,
  onExit,
  onSignOut,
}: OrgAdminPanelProps) {
  const displayName = userName || "Admin";
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";
  const panels = [
    {
      id: "analytics",
      label: "Analytics dashboard",
      detail: "Dashboard visibility and KPIs.",
      render: () => (
        <HRDashboard
          organizationId={organizationId}
          createdBy={createdBy}
        />
      ),
    },
    {
      id: "employee-summary",
      label: "Employee summary",
      detail: "Headcount, tenure, and diversity summary.",
      render: () => <EmployeeSummary organizationId={organizationId} />,
    },
    {
      id: "org-overview",
      label: "Org overview",
      detail: "Created dashboards and org health checks.",
      render: () => <OrgOverview organizationId={organizationId} />,
    },
  ];
  const [activeId, setActiveId] = useState(panels[0].id);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const activePanel = panels.find((panel) => panel.id === activeId) ?? panels[0];

  return (
    <NotificationsProvider>
      <div className="admin-page" data-theme={theme}>
        <AdminSidebar
          items={panels.map(({ id, label, detail }) => ({
            id,
            label,
            description: detail,
          }))}
          activeId={activeId}
          onSelect={setActiveId}
          theme={theme}
          onToggleTheme={() =>
            setTheme((prev) => (prev === "light" ? "dark" : "light"))
          }
          organizationId={organizationId}
        />

        <main className="admin-main">
          <AdminHeader
            actions={
              <div className="admin-header__tools">
                <div className="admin-header__left">
                  {onExit ? (
                    <button
                      type="button"
                      className="admin-back"
                      onClick={onExit}
                    >
                      Back
                    </button>
                  ) : null}
                </div>
                <div className="admin-header__right">
                  <NotificationsBell />
                  <AdminProfileMenu
                    displayName={displayName}
                    initial={initial}
                    onSignOut={onSignOut}
                  />
                </div>
              </div>
            }
          />

          <div className="admin-divider" role="presentation" />
          <div className="admin-content">
            {activePanel.render()}
          </div>
        </main>
      </div>
    </NotificationsProvider>
  );
}

export { OrgAdminPanel };
