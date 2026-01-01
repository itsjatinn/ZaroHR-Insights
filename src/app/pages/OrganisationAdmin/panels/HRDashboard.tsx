import { useEffect, useState } from "react";
import { FiBarChart2, FiClock, FiEye } from "react-icons/fi";

const DEFAULT_ORG_LABEL = "Your organization";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

const dashboards = [
  {
    title: "HR Dashboard",
    status: "Live",
  },
];

interface HRDashboardProps {
  organizationId?: string | null;
  createdBy?: string | null;
}

function HRDashboard({ organizationId, createdBy }: HRDashboardProps) {
  const [availableMonths, setAvailableMonths] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [orgLabel, setOrgLabel] = useState<string>(DEFAULT_ORG_LABEL);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const loadMonths = async () => {
      try {
        const params = new URLSearchParams({
          organizationId,
        });
        const response = await fetch(
          `${API_BASE_URL}/org/dashboard-months?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = (await response.json()) as {
          months?: Array<{ monthKey: string; monthLabel: string }>;
        };
        if (!cancelled) {
          const months =
            payload.months?.map((month) => ({
              key: month.monthKey,
              label: month.monthLabel,
            })) ?? [];
          setAvailableMonths(months);
        }
      } catch {
        if (!cancelled) {
          setAvailableMonths([]);
        }
      }
    };
    loadMonths();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setOrgLabel(DEFAULT_ORG_LABEL);
      return;
    }
    let cancelled = false;
    const loadOrgLabel = async () => {
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
        if (!cancelled) {
          const payload = (await response.json()) as {
            organizationName?: string | null;
          };
          setOrgLabel(payload.organizationName || DEFAULT_ORG_LABEL);
        }
      } catch {
        if (!cancelled) {
          setOrgLabel(DEFAULT_ORG_LABEL);
        }
      }
    };
    loadOrgLabel();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const creatorLabel = createdBy?.trim() || "Admin";
  const canPreview = Boolean(organizationId);

  const handlePreview = (monthKey: string, monthLabel: string) => {
    if (!organizationId) return;
    const params = new URLSearchParams({
      view: "dashboard",
      orgId: organizationId,
      orgLabel,
      orgMeta: "",
      month: monthKey,
      monthLabel,
    });
    window.open(
      `${window.location.origin}?${params.toString()}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <div className="admin-stack">
      <div className="admin-card">
        <div className="admin-card__header">
          <div>
            <h3>Created dashboards</h3>
            <p className="admin-card__subtitle">
              Track the dashboards visible for {orgLabel}.
            </p>
          </div>
        </div>
        <div className="org-dashboard-cards">
          {availableMonths.length ? (
            availableMonths.map((month, index) => (
              <div key={month.key} className="org-dashboard-card">
                <div className="org-dashboard-card__title">
                  <FiBarChart2 size={18} aria-hidden="true" />
                  <div>
                    <p>{dashboards[0].title}</p>
                    <span>Uploaded month: {month.label}</span>
                  </div>
                </div>
                <div className="org-dashboard-card__meta">
                  <span>
                    <FiClock size={14} aria-hidden="true" /> Created by: {creatorLabel}
                  </span>
                  {index === 0 ? (
                    <span className="admin-badge admin-badge--neutral org-dashboard-card__badge--recent">
                      Recent
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="admin-button admin-button--ghost"
                  onClick={() => handlePreview(month.key, month.label)}
                  disabled={!canPreview}
                >
                  <FiEye size={16} aria-hidden="true" /> Preview
                </button>
              </div>
            ))
          ) : (
            <div className="admin-upload-card">
              <p className="admin-upload-error">No dashboards uploaded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { HRDashboard };
