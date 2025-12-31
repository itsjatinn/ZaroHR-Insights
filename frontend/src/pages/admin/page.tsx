import { useEffect, useRef, useState } from "react";
import "./admin.css";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";
import { AdminProfileMenu } from "./AdminProfileMenu";
import {
  NotificationsBell,
  NotificationsProvider,
  useNotifications,
} from "./components/notifications/Notifications";
import { DashboardsPanel } from "./components/panels/DashboardsPanel";
import type { DashboardSelection } from "./components/panels/DashboardsPanel";
import { DashboardConfigPanel } from "./components/panels/DashboardConfigPanel";
import { EmployeeSummaryPanel } from "./components/panels/EmployeeSummaryPanel";
import { OrganizationsPanel } from "./components/panels/OrganizationsPanel";
import { OverviewPanel } from "./components/panels/OverviewPanel";
import { UploadsPanel } from "./components/panels/UploadsPanel";

interface AdminPageProps {
  onExit?: () => void;
  onOpenDashboard?: (selection: DashboardSelection) => void;
  userName?: string | null;
  onSignOut?: () => void;
}

type AdminPanel = {
  id: string;
  label: string;
  title: string;
  detail: string;
  render: () => JSX.Element;
};

function AdminPage({
  onExit,
  onOpenDashboard,
  userName,
  onSignOut,
}: AdminPageProps) {
  const displayName = userName || "Admin";
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";
  const panels: AdminPanel[] = [
    {
      id: "overview",
      label: "Overview",
      title: "Dashboard Overview",
      detail: "Monitor all organizations and analytics",
      render: () => <OverviewPanel />,
    },
    {
      id: "organizations",
      label: "Organizations",
      title: "Organizations",
      detail: "Access controls and organization insights",
      render: () => <OrganizationsPanel />,
    },
    {
      id: "uploads",
      label: "Data Uploads",
      title: "Data Uploads",
      detail: "Track and manage ingestion queue",
      render: () => <UploadsPanel onOpenDashboard={onOpenDashboard} />,
    },
    {
      id: "dashboards",
      label: "Dashboards",
      title: "Dashboards",
      detail: "Filter dashboards by organization and month",
      render: () => (
        <DashboardsPanel onOpenDashboard={onOpenDashboard} />
      ),
    },
    {
      id: "employee-summary",
      label: "Employee Summary",
      title: "Employee Summary",
      detail: "Search employee profiles by organization",
      render: () => <EmployeeSummaryPanel />,
    },
    {
      id: "dashboard-config",
      label: "Dashboard Config",
      title: "Dashboard Config",
      detail: "Alerts, cadence, and preview settings",
      render: () => <DashboardConfigPanel />,
    },
  ];
  const [activeId, setActiveId] = useState(panels[0].id);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const activePanel = panels.find((panel) => panel.id === activeId) ?? panels[0];

  return (
    <NotificationsProvider>
      <AdminShell
        activePanel={activePanel}
        panels={panels}
        activeId={activeId}
        displayName={displayName}
        initial={initial}
        onExit={onExit}
        onSignOut={onSignOut}
        setActiveId={setActiveId}
        theme={theme}
        setTheme={setTheme}
      />
    </NotificationsProvider>
  );
}

export default AdminPage;

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type AdminShellProps = {
  panels: AdminPanel[];
  activePanel: AdminPanel;
  activeId: string;
  displayName: string;
  initial: string;
  onExit?: () => void;
  onSignOut?: () => void;
  setActiveId: (id: string) => void;
  theme: "dark" | "light";
  setTheme: (value: "dark" | "light") => void;
};

function AdminShell({
  panels,
  activePanel,
  activeId,
  displayName,
  initial,
  onExit,
  onSignOut,
  setActiveId,
  theme,
  setTheme,
}: AdminShellProps) {
  const { addNotification } = useNotifications();
  const lastHealth = useRef<"ok" | "error" | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
          throw new Error("Health check failed.");
        }
        const payload = (await response.json()) as { status?: string };
        if (!mounted) return;
        if (payload.status === "ok") {
          if (lastHealth.current === "error") {
            addNotification({
              title: "System healthy",
              message: "API recovered after a health check failure.",
              type: "success",
            });
          }
          lastHealth.current = "ok";
        } else {
          if (lastHealth.current !== "error") {
            addNotification({
              title: "System health warning",
              message: "Health check reported a non-ok status.",
              type: "warning",
            });
          }
          lastHealth.current = "error";
        }
      } catch (err) {
        if (!mounted) return;
        if (lastHealth.current !== "error") {
          addNotification({
            title: "System health error",
            message:
              err instanceof Error
                ? err.message
                : "Unable to reach the API health endpoint.",
            type: "error",
          });
        }
        lastHealth.current = "error";
      }
    };
    checkHealth();
    const intervalId = window.setInterval(checkHealth, 90000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [addNotification]);

  return (
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
          setTheme(theme === "light" ? "dark" : "light")
        }
      />

      <main className="admin-main">
        <AdminHeader
          actions={
            <div className="admin-header__tools">
              <div className="admin-header__left">
                {onExit ? (
                  <button type="button" className="admin-back" onClick={onExit}>
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
  );
}
