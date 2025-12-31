import {
  FiBarChart2,
  FiClipboard,
  FiGrid,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { cn } from "./lib/utils";
import type { JSX } from "react";
import { useEffect, useState } from "react";

export interface AdminNavItem {
  id: string;
  label: string;
  description?: string;
}

interface AdminSidebarProps {
  items: AdminNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  organizationId?: string | null;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const navIcons: Record<string, JSX.Element> = {
  analytics: <FiBarChart2 size={18} aria-hidden="true" />,
  "employee-summary": <FiUsers size={18} aria-hidden="true" />,
  "org-overview": <FiGrid size={18} aria-hidden="true" />,
};

function AdminSidebar({
  items,
  activeId,
  onSelect,
  theme,
  onToggleTheme,
  organizationId,
}: AdminSidebarProps) {
  const [dashboardsCount, setDashboardsCount] = useState<number | null>(null);
  const [reportsCount, setReportsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setDashboardsCount(null);
      setReportsCount(null);
      return;
    }
    let cancelled = false;
    const loadMetrics = async () => {
      try {
        const params = new URLSearchParams({
          organizationId,
        });
        const response = await fetch(
          `${API_BASE_URL}/org/metrics?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = (await response.json()) as {
          dashboards?: number;
          reports?: number;
        };
        if (!cancelled) {
          setDashboardsCount(payload.dashboards ?? 0);
          setReportsCount(payload.reports ?? 0);
        }
      } catch {
        if (!cancelled) {
          setDashboardsCount(null);
          setReportsCount(null);
        }
      }
    };
    loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="admin-brand__mark">
          <FiUser size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="admin-brand__title">ZaroHR Insights</p>
          <p className="admin-brand__subtitle">Org Admin </p>
        </div>
      </div>

      <nav className="admin-nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "admin-nav__item",
              activeId === item.id && "admin-nav__item--active",
            )}
            onClick={() => onSelect(item.id)}
            aria-current={activeId === item.id ? "page" : undefined}
          >
            <span className="admin-nav__icon" aria-hidden="true">
              {navIcons[item.id] ?? navIcons["org-overview"]}
            </span>
            <span className="admin-nav__label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="admin-quick">
        <div className="admin-quick__title">
          <span className="admin-quick__icon" aria-hidden="true">
            <FiClipboard size={18} aria-hidden="true" />
          </span>
          <span>Quick Stats</span>
        </div>
        <div className="admin-quick__row">
          <div>
            <p>Dashboards</p>
            <strong>{dashboardsCount ?? "—"}</strong>
          </div>
          <div>
            <p>Reports</p>
            <strong>{reportsCount ?? "—"}</strong>
          </div>
        </div>
        <div className="admin-quick__theme">
          <span>Theme</span>
          <div className="admin-theme-toggle">
            <span>Dark</span>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={theme === "light"}
                onChange={onToggleTheme}
                aria-label="Toggle light theme"
              />
              <span className="admin-switch__track" aria-hidden="true" />
            </label>
            <span>Light</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export { AdminSidebar };
