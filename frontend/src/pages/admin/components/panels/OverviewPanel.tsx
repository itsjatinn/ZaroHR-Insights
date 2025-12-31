import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiBriefcase, FiFileText, FiLayers, FiMail, FiUsers } from "react-icons/fi";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type SummaryItem = {
  label: string;
  value: number;
  meta?: string | null;
};

type UploadItem = {
  name: string;
  org: string | null;
  date: string;
  rows: number;
};

type OrganizationItem = {
  name: string;
  sector: string | null;
  count: number;
};

type OverviewResponse = {
  summary: SummaryItem[];
  uploads: UploadItem[];
  organizations: OrganizationItem[];
};

type DemoLeadItem = {
  id: string;
  email: string;
  source?: string | null;
  createdAt: string;
};

type DemoLeadResponse = {
  leads: DemoLeadItem[];
};

function OverviewPanel() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoLeads, setDemoLeads] = useState<DemoLeadItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/admin/overview`);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = (await response.json()) as OverviewResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load overview.");
        }
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
  }, []);

  const summary = useMemo(
    () => [
      {
        label: "Total Organizations",
        value: data?.summary.find((item) => item.label === "Total Organizations")
          ?.value ?? 0,
        tone: "info",
        icon: <FiLayers size={20} aria-hidden="true" />,
      },
      {
        label: "Total Employees",
        value: data?.summary.find((item) => item.label === "Total Employees")
          ?.value ?? 0,
        tone: "success",
        icon: <FiUsers size={20} aria-hidden="true" />,
      },
      {
        label: "Contact Leads",
        value: data?.summary.find((item) => item.label === "Contact Leads")
          ?.value ?? 0,
        tone: "warning",
        icon: <FiMail size={20} aria-hidden="true" />,
      },
      {
        label: "Active Dashboards",
        value: data?.summary.find((item) => item.label === "Active Dashboards")
          ?.value ?? 0,
        tone: "accent",
        icon: <FiActivity size={20} aria-hidden="true" />,
      },
    ],
    [data]
  );

  const uploads = data?.uploads ?? [];
  const organizations = data?.organizations ?? [];

  const formatRows = (rows: number) =>
    `${rows.toLocaleString()} rows`;

  const formatDate = (date: string) => {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("en-GB");
  };

  const loadDemoLeads = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/leads/demo`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as DemoLeadResponse;
      setDemoLeads(payload.leads ?? []);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Unable to load demo users.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleOpenDemoUsers = () => {
    setDemoOpen(true);
    loadDemoLeads();
  };

  return (
    <div className="admin-stack">
      {loading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Turning data into decisions…</p>
              <p className="dashboard-loading__subtitle">
                Refreshing your admin overview.
              </p>
            </div>
          </div>
        </div>
      )}
      {!loading && error && (
        <div className="admin-upload-card">
          <p className="admin-upload-error">⚠️ {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="admin-summary">
            {summary.map((item) => (
              item.label === "Contact Leads" ? (
                <button
                  key={item.label}
                  type="button"
                  className={`admin-summary-card admin-summary-card--button tone-${item.tone}`}
                  onClick={handleOpenDemoUsers}
                >
                  <div>
                    <p className="admin-summary-card__label">{item.label}</p>
                    <p className="admin-summary-card__value">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                  <span className="admin-summary-card__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                </button>
              ) : (
                <div key={item.label} className={`admin-summary-card tone-${item.tone}`}>
                  <div>
                    <p className="admin-summary-card__label">{item.label}</p>
                    <p className="admin-summary-card__value">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                  <span className="admin-summary-card__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                </div>
              )
            ))}
          </div>

          <div className="admin-overview-grid">
            <div className="admin-card admin-card--tall">
              <div className="admin-card__header">
                <div>
                  <h3>Recent Uploads</h3>
                  <p className="admin-card__subtitle">Latest data files uploaded</p>
                </div>
              </div>
              <div className="admin-list admin-list--cards">
                {uploads.map((item) => (
                  <div key={item.name} className="admin-list__item">
                    <div className="admin-list__icon" aria-hidden="true">
                      <FiFileText size={18} />
                    </div>
                    <div>
                      <p className="admin-list__title">{item.name}</p>
                      <p className="admin-list__detail">{item.org || "—"}</p>
                    </div>
                    <div className="admin-list__meta">
                      <span>{formatDate(item.date)}</span>
                      <strong>{formatRows(item.rows)}</strong>
                    </div>
                  </div>
                ))}
                {!uploads.length && (
                  <div className="admin-list__item">
                    <p className="admin-list__detail">No uploads yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-card admin-card--tall">
              <div className="admin-card__header">
                <div>
                  <h3>Organizations</h3>
                  <p className="admin-card__subtitle">
                    Active organizations by industry
                  </p>
                </div>
              </div>
              <div className="admin-list admin-list--cards">
                {organizations.map((item) => (
                  <div key={item.name} className="admin-list__item">
                    <div className="admin-list__avatar" aria-hidden="true">
                      <FiBriefcase size={18} />
                    </div>
                    <div>
                      <p className="admin-list__title">{item.name}</p>
                      <p className="admin-list__detail">{item.sector || "—"}</p>
                    </div>
                    <div className="admin-list__meta">
                      <strong>{item.count.toLocaleString()}</strong>
                      <span>employees</span>
                    </div>
                  </div>
                ))}
                {!organizations.length && (
                  <div className="admin-list__item">
                    <p className="admin-list__detail">No organizations yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {demoOpen && (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setDemoOpen(false)}
        >
          <div
            className="admin-modal__card admin-modal__card--wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h3>Contact Leads</h3>
              <p className="admin-card__subtitle">
                Emails collected from the contact form.
              </p>
            </div>
            {demoLoading && (
              <p className="admin-upload-error">Loading contact leads…</p>
            )}
            {!demoLoading && demoError && (
              <p className="admin-upload-error">⚠️ {demoError}</p>
            )}
            {!demoLoading && !demoError && (
              <div className="admin-list admin-list--cards">
                {demoLeads.map((lead) => (
                  <div key={lead.id} className="admin-list__item">
                    <div className="admin-list__avatar" aria-hidden="true">
                      <FiMail size={18} />
                    </div>
                    <div>
                      <p className="admin-list__title">{lead.email}</p>
                      <p className="admin-list__detail">{lead.source || "—"}</p>
                    </div>
                    <div className="admin-list__meta">
                      <span>{formatDate(lead.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {!demoLeads.length && (
                  <div className="admin-list__item">
                      <p className="admin-list__detail">No contact leads yet.</p>
                  </div>
                )}
              </div>
            )}
            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={() => setDemoOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { OverviewPanel };
