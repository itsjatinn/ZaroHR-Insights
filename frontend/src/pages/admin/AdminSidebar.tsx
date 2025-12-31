import {
  FiBarChart2,
  FiClipboard,
  FiGrid,
  FiSettings,
  FiUploadCloud,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { cn } from "./lib/utils";
import type { JSX } from "react";
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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
}

const navIcons: Record<string, JSX.Element> = {
  overview: <FiGrid size={18} aria-hidden="true" />,
  dashboards: <FiBarChart2 size={18} aria-hidden="true" />,
  organizations: <FiUsers size={18} aria-hidden="true" />,
  uploads: <FiUploadCloud size={18} aria-hidden="true" />,
  "dashboard-config": <FiSettings size={18} aria-hidden="true" />,
};

function AdminSidebar({
  items,
  activeId,
  onSelect,
  theme,
  onToggleTheme,
}: AdminSidebarProps) {
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [fileCount, setFileCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/overview`);
        if (!response.ok) return;
        const payload = await response.json();
        const summary = payload.summary ?? [];
        const org = summary.find((item: { label: string }) =>
          item.label?.toLowerCase().includes("organizations")
        );
        const files = summary.find((item: { label: string }) =>
          item.label?.toLowerCase().includes("uploaded")
        );
        setOrgCount(typeof org?.value === "number" ? org.value : null);
        setFileCount(typeof files?.value === "number" ? files.value : null);
      } catch {
        setOrgCount(null);
        setFileCount(null);
      }
    };
    fetchQuickStats();
  }, []);

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="admin-brand__mark">
          <FiUser size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="admin-brand__title">ZaroHR Insights</p>
          <p className="admin-brand__subtitle">Admin Panel</p>
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
              {navIcons[item.id] ?? navIcons.overview}
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
            <p>Organizations</p>
            <strong>{orgCount ?? "—"}</strong>
          </div>
          <div>
            <p>Files</p>
            <strong>{fileCount ?? "—"}</strong>
          </div>
        </div>
        <div className="admin-quick__theme">
          
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
