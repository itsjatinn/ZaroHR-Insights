import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiFileText, FiTrendingUp } from "react-icons/fi";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

type OrgMetricsResponse = {
  organizationId: string;
  organizationName: string;
  dashboards: number;
  reports: number;
};

type OrgDashboardMonth = {
  key: string;
  label: string;
};

function OrgOverview({ organizationId }: { organizationId?: string | null }) {
  const [metrics, setMetrics] = useState<OrgMetricsResponse | null>(null);
  const [months, setMonths] = useState<OrgDashboardMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setMetrics(null);
      setMonths([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ organizationId });
        const [metricsResponse, monthsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/org/metrics?${params.toString()}`),
          fetch(`${API_BASE_URL}/org/dashboard-months?${params.toString()}`),
        ]);
        if (!metricsResponse.ok) {
          throw new Error(await metricsResponse.text());
        }
        if (!monthsResponse.ok) {
          throw new Error(await monthsResponse.text());
        }
        const metricsPayload = (await metricsResponse.json()) as OrgMetricsResponse;
        const monthsPayload = (await monthsResponse.json()) as {
          months?: Array<{ monthKey: string; monthLabel: string }>;
        };
        if (cancelled) return;
        setMetrics(metricsPayload);
        setMonths(
          (monthsPayload.months ?? []).map((month) => ({
            key: month.monthKey,
            label: month.monthLabel,
          }))
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load overview.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const orgName = metrics?.organizationName ?? "Organization";
  const latestMonthLabel = months[0]?.label ?? "—";

  const summary = useMemo(
    () => [
      {
        label: "Dashboards",
        value: metrics ? `${metrics.dashboards}` : "0",
        meta: "Available",
        icon: <FiActivity size={18} aria-hidden="true" />,
      },
      {
        label: "Uploads",
        value: metrics ? `${metrics.reports}` : "0",
        meta: "Files",
        icon: <FiFileText size={18} aria-hidden="true" />,
      },
      {
        label: "Latest month",
        value: latestMonthLabel,
        meta: "Dashboard data",
        icon: <FiTrendingUp size={18} aria-hidden="true" />,
      },
    ],
    [latestMonthLabel, metrics, orgName]
  );

  const recentDashboards = months.slice(0, 3).map((month) => ({
    title: "HR Dashboard",
    org: orgName,
    updated: month.label,
  }));

  const alerts = useMemo(() => {
    const items = [];
    if (months.length === 0) {
      items.push({
        title: "No dashboards released yet",
        detail: "Upload data to generate your first dashboard.",
      });
    } else {
      items.push({
        title: "Latest dashboard available",
        detail: `Current reporting month: ${latestMonthLabel}.`,
      });
    }
    if (metrics && metrics.reports === 0) {
      items.push({
        title: "No uploads found",
        detail: "Add a data file to populate charts and summaries.",
      });
    }
    return items;
  }, [latestMonthLabel, metrics, months.length]);

  return (
    <div className="admin-stack">
      {loading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Loading overview…</p>
              <p className="dashboard-loading__subtitle">
                Preparing organization insights.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="admin-upload-error">⚠️ {error}</p>}

      {!loading && (
        <>
          <div className="admin-summary">
            {summary.map((item) => (
              <div key={item.label} className="admin-summary-card">
                <div>
                  <p className="admin-summary-card__label">{item.label}</p>
                  <p className="admin-summary-card__value">{item.value}</p>
                  <p className="admin-summary-card__meta">{item.meta}</p>
                </div>
                <span className="admin-summary-card__icon" aria-hidden="true">
                  {item.icon}
                </span>
              </div>
            ))}
          </div>

          <div className="admin-overview-grid">
            <div className="admin-card admin-card--tall">
              <div className="admin-card__header">
                <div>
                  <h3>Recent dashboards</h3>
                  <p className="admin-card__subtitle">Latest releases for {orgName}</p>
                </div>
              </div>
              <div className="admin-list admin-list--cards">
                {recentDashboards.length ? (
                  recentDashboards.map((item) => (
                    <div key={`${item.title}-${item.updated}`} className="admin-list__item">
                      <div>
                        <p className="admin-list__title">{item.title}</p>
                        <p className="admin-list__detail">{item.org}</p>
                      </div>
                      <div className="admin-list__meta">
                        <span>Month</span>
                        <strong>{item.updated}</strong>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="admin-list__detail">No dashboards released yet.</p>
                )}
              </div>
            </div>

            <div className="admin-card admin-card--tall">
              <div className="admin-card__header">
                <div>
                  <h3>Alerts</h3>
                  <p className="admin-card__subtitle">Items that need attention</p>
                </div>
              </div>
              <div className="admin-list admin-list--cards">
                {alerts.length ? (
                  alerts.map((item) => (
                    <div key={item.title} className="admin-list__item">
                      <div>
                        <p className="admin-list__title">{item.title}</p>
                        <p className="admin-list__detail">{item.detail}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="admin-list__detail">No alerts right now.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { OrgOverview };
