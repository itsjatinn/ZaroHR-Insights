import { useEffect, useMemo, useState } from "react";
import { FiSettings } from "react-icons/fi";
import { Select } from "../ui/Select";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

const modules = [
  {
    key: "manpower_rampup",
    title: "Manpower Ramp-Up",
    detail: "Headcount movement over time",
    enabled: true,
  },
  {
    key: "hires_exits",
    title: "Hires vs Exits",
    detail: "Monthly hires and exits comparison",
    enabled: true,
  },
  {
    key: "worklevel_overview",
    title: "Work level wise HC & Demographics Overview",
    detail: "Headcount, tenure, and age by work level",
    enabled: true,
  },
  {
    key: "entity_overview",
    title: "Entity wise HC & Demographics Overview",
    detail: "Headcount, tenure, and age by entity",
    enabled: true,
  },
  {
    key: "overall_attrition",
    title: "Overall Attrition",
    detail: "Total attrition trend over time",
    enabled: true,
  },
  {
    key: "entity_attrition",
    title: "Entity wise 4 year period attrition",
    detail: "Attrition trend by entity",
    enabled: true,
  },
  {
    key: "age_attrition",
    title: "Age group wise 4 year period",
    detail: "Attrition by age group",
    enabled: true,
  },
  {
    key: "gender_attrition",
    title: "Gender wise 4 year period",
    detail: "Attrition by gender",
    enabled: true,
  },
  {
    key: "tenure_attrition",
    title: "Tenure wise 4 year period",
    detail: "Attrition by tenure band",
    enabled: true,
  },
];

type ToastState = {
  title: string;
  message: string;
} | null;

function DashboardConfigPanel() {
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [orgOptions, setOrgOptions] = useState<
    { label: string; value: string; meta?: string }[]
  >([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    modules.reduce((acc, module) => {
      acc[module.key] = module.enabled;
      return acc;
    }, {} as Record<string, boolean>),
  );
  const [toast, setToast] = useState<ToastState>(null);
  const [loading, setLoading] = useState(true);

  const visibleCount = useMemo(
    () => Object.values(enabledMap).filter(Boolean).length,
    [enabledMap],
  );

  const hiddenCount = modules.length - visibleCount;

  const saveConfig = async (nextMap: Record<string, boolean>) => {
    if (!selectedOrg) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrg,
          charts: modules.map((module) => ({
            key: module.key,
            enabled: nextMap[module.key],
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch (err) {
      setToast({
        title: "Save failed",
        message:
          err instanceof Error
            ? err.message
            : "Unable to save dashboard configuration.",
      });
    }
  };

  const handleToggle = (key: string) => {
    setEnabledMap((prev) => {
      const nextValue = !prev[key];
      const nextMap = { ...prev, [key]: nextValue };
      const orgName =
        orgOptions.find((org) => org.value === selectedOrg)?.label ??
        "the organization";
      const moduleTitle = modules.find((module) => module.key === key)?.title ?? key;
      setToast({
        title: nextValue ? "Component Enabled" : "Component Disabled",
        message: `${moduleTitle} is now ${nextValue ? "visible" : "hidden"} for ${orgName}`,
      });
      saveConfig(nextMap);
      return nextMap;
    });
  };

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const fetchOrganizations = async () => {
      setOrgLoading(true);
      setOrgError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/organizations`);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        const options = (payload.organizations ?? []).map(
          (org: { id: string; name: string; code?: string | null }) => ({
            label: org.name,
            value: org.id,
            meta: org.code ?? "No sector",
          })
        );
        setOrgOptions(options);
        if (options.length && !selectedOrg) {
          setSelectedOrg(options[0].value);
        }
      } catch (err) {
        setOrgError(
          err instanceof Error ? err.message : "Unable to load organizations."
        );
      } finally {
        setOrgLoading(false);
        setLoading(false);
      }
    };
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (!selectedOrg) return;
    const fetchConfig = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/admin/dashboard-config?organizationId=${selectedOrg}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        const nextMap = modules.reduce((acc, module) => {
          const found = payload.charts?.find(
            (item: { key: string }) => item.key === module.key
          );
          acc[module.key] = found?.enabled ?? true;
          return acc;
        }, {} as Record<string, boolean>);
        setEnabledMap(nextMap);
      } catch (err) {
        setToast({
          title: "Load failed",
          message:
            err instanceof Error
              ? err.message
              : "Unable to load dashboard configuration.",
        });
      }
    };
    fetchConfig();
  }, [selectedOrg]);

  return (
    <div className="admin-config">
      {loading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Turning data into decisions…</p>
              <p className="dashboard-loading__subtitle">
                Preparing configuration.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <>
      <div className="admin-config__header">
        <h3>Dashboard Configuration</h3>
        <p>Control which analytics components are visible for each organization</p>
      </div>

      <div className="admin-upload-card admin-config__select">
        <div>
          <h4>Select Organization</h4>
          <p>Choose which organization's dashboard to configure</p>
        </div>
        <Select
          options={orgOptions}
          value={selectedOrg}
          onChange={setSelectedOrg}
          placeholder={orgLoading ? "Loading organizations..." : "Select organization"}
        />
      </div>
      {orgError && <p className="admin-upload-error">⚠️ {orgError}</p>}

      <div className="admin-config__badges">
        <span className="admin-config__chip admin-config__chip--active">
          {visibleCount} visible
        </span>
        <span className="admin-config__chip">{hiddenCount} hidden</span>
      </div>

      <div className="admin-config__grid">
        {modules.map((module) => (
          <div
            key={module.title}
            className={`admin-config__card ${
              enabledMap[module.key] ? "is-active" : "is-muted"
            }`}
          >
            <div className="admin-config__card-icon" aria-hidden="true">
              <FiSettings size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="admin-config__card-title">{module.title}</p>
              <p className="admin-config__card-detail">{module.detail}</p>
            </div>
            <label className="admin-config__switch">
              <input
                type="checkbox"
                checked={enabledMap[module.key]}
                onChange={() => handleToggle(module.key)}
              />
              <span className="admin-config__switch-track" />
            </label>
          </div>
        ))}
      </div>

      {toast ? (
        <div className="admin-toast" role="status">
          <div>
            <p className="admin-toast__title">{toast.title}</p>
            <p className="admin-toast__message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="admin-toast__close"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}

export { DashboardConfigPanel };
