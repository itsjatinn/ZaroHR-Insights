import { useEffect, useState } from "react";
import { Select } from "../ui/Select";
import { useNotifications } from "../notifications/Notifications";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

export type DashboardSelection = {
  orgId: string;
  orgLabel: string;
  orgMeta?: string;
  month: string;
  monthLabel: string;
};

interface DashboardsPanelProps {
  onOpenDashboard?: (selection: DashboardSelection) => void;
}

type Organization = {
  id: string;
  name: string;
  code: string | null;
};

function DashboardsPanel({ onOpenDashboard }: DashboardsPanelProps) {
  const { addNotification } = useNotifications();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [monthOptions, setMonthOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [monthsLoading, setMonthsLoading] = useState(false);
  const [monthsError, setMonthsError] = useState<string | null>(null);
  const org = organizations.find((item) => item.id === selectedOrg) ?? null;
  const month = monthOptions.find((item) => item.value === selectedMonth) ?? null;
  const canOpen = Boolean(org && month) && !openLoading && !monthsLoading;
  const canRelease = Boolean(org && month) && !releaseLoading;
  const canDelete = Boolean(org && month) && !deleteLoading;

  const handleOpen = async () => {
    if (!org || !month || !onOpenDashboard || monthsLoading) return;
    setOpenLoading(true);
    setOpenError(null);
    try {
      const params = new URLSearchParams({
        organization_id: org.id,
        month_key: month.value,
      });
      const response = await fetch(
        `${API_BASE_URL}/analytics/manpower-rampup?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as { points?: Array<unknown> };
      if (!payload.points?.length) {
        setOpenError(
          `No dashboard data available for ${org.name} · ${month.label}.`
        );
        return;
      }
      onOpenDashboard({
        orgId: org.id,
        orgLabel: org.name,
        orgMeta: org.code ?? undefined,
        month: month.value,
        monthLabel: month.label,
      });
    } catch (err) {
      setOpenError(
        err instanceof Error
          ? err.message
          : "Unable to verify dashboard data."
      );
    } finally {
      setOpenLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!org || !month) return;
    setReleaseLoading(true);
    setReleaseError(null);
    setReleaseMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/release-dashboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          monthKey: month.value,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as { credentialsSent?: boolean };
      setReleaseMessage(
        payload.credentialsSent
          ? `Release email sent with login credentials for ${month.label}.`
          : `Release email sent without credentials for ${month.label}.`
      );
      addNotification({
        title: "Dashboard released",
        message: payload.credentialsSent
          ? `Credentials sent for ${org.name} · ${month.label}.`
          : `Release sent without credentials for ${org.name} · ${month.label}.`,
        type: "success",
      });
    } catch (err) {
      setReleaseError(
        err instanceof Error ? err.message : "Unable to release dashboard."
      );
      addNotification({
        title: "Release failed",
        message:
          err instanceof Error ? err.message : "Unable to release dashboard.",
        type: "error",
      });
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!org || !month) return;
    const confirmed = window.confirm(
      `Delete dashboard data for ${org.name} · ${month.label}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    setDeleteError(null);
    setDeleteMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          monthKey: month.value,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as { deletedUploads?: number };
      const deleted = payload.deletedUploads ?? 0;
      setDeleteMessage(`Deleted ${deleted} upload(s) for ${month.label}.`);
      addNotification({
        title: "Dashboard data deleted",
        message: `Removed ${deleted} upload(s) for ${org.name} · ${month.label}.`,
        type: "success",
      });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete dashboard data."
      );
      addNotification({
        title: "Delete failed",
        message:
          err instanceof Error ? err.message : "Unable to delete dashboard data.",
        type: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

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
        setOrganizations(payload.organizations ?? []);
      } catch (err) {
        setOrgError(
          err instanceof Error ? err.message : "Unable to load organizations."
        );
      } finally {
        setOrgLoading(false);
      }
    };
    fetchOrganizations();
  }, []);

  useEffect(() => {
    const fetchMonths = async () => {
      if (!selectedOrg) {
        setMonthOptions([]);
        setSelectedMonth(null);
        setMonthsError(null);
        return;
      }
      setMonthsLoading(true);
      setMonthsError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/admin/dashboard-months?organizationId=${selectedOrg}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = (await response.json()) as {
          months?: { monthKey: string; monthLabel: string }[];
        };
        const options =
          payload.months?.map((item) => ({
            label: item.monthLabel,
            value: item.monthKey,
          })) ?? [];
        setMonthOptions(options);
        if (!options.find((item) => item.value === selectedMonth)) {
          setSelectedMonth(null);
        }
      } catch (err) {
        setMonthsError(
          err instanceof Error ? err.message : "Unable to load dashboard months."
        );
        setMonthOptions([]);
        setSelectedMonth(null);
      } finally {
        setMonthsLoading(false);
      }
    };
    fetchMonths();
  }, [selectedOrg, selectedMonth]);

  useEffect(() => {
    setOpenError(null);
  }, [selectedOrg, selectedMonth]);

  return (
    <div className="admin-uploads">
      {orgLoading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Turning data into decisions…</p>
              <p className="dashboard-loading__subtitle">
                Loading dashboards.
              </p>
            </div>
          </div>
        </div>
      )}

      {!orgLoading && (
        <>
          <div className="admin-uploads__header">
            <h3>Dashboards</h3>
            <p>Choose an organization and month to view its dashboard data</p>
          </div>

          <div className="admin-upload-card">
            <div className="admin-dashboard-filters">
              <div className="admin-dashboard-filters__item">
                <div>
                  <h4>Select Organization</h4>
                  <p>Choose which organization's dashboard to view</p>
                </div>
                <Select
                  options={organizations.map((item) => ({
                    label: item.name,
                    value: item.id,
                    meta: item.code ?? "No code",
                  }))}
                  value={selectedOrg}
                  placeholder="Select an organization"
                  onChange={setSelectedOrg}
                />
              </div>
              <div className="admin-dashboard-filters__item">
                <div>
                  <h4>Select Month</h4>
                  <p>Pick the reporting month for the dashboard</p>
                </div>
                <Select
                  options={monthOptions}
                  value={selectedMonth}
                  placeholder="Select a month"
                  onChange={setSelectedMonth}
                />
              </div>
            </div>
            {monthsLoading && (
              <p className="admin-upload-error">Loading dashboard months…</p>
            )}
            {!monthsLoading && !monthsError && org && !monthOptions.length && (
              <p className="admin-upload-error">
                No dashboard months available for this organization.
              </p>
            )}
            {monthsError && <p className="admin-upload-error">⚠️ {monthsError}</p>}
            <div className="admin-dashboard-filters__actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={!canOpen}
                onClick={handleOpen}
              >
                {openLoading ? "Checking..." : "Open Dashboard"}
              </button>
              <button
                type="button"
                className="admin-button admin-button--danger"
                disabled={!canDelete}
                onClick={handleDelete}
              >
                {deleteLoading ? "Deleting..." : "Delete dashboard data"}
              </button>
            </div>
            {openError && <p className="admin-upload-error">⚠️ {openError}</p>}
            {orgError && <p className="admin-upload-error">⚠️ {orgError}</p>}
            {deleteMessage && (
              <p className="admin-upload-success">{deleteMessage}</p>
            )}
            {deleteError && <p className="admin-upload-error">⚠️ {deleteError}</p>}
          </div>

          <div className="admin-upload-card">
            <div className="admin-dashboard-filters">
              <div className="admin-dashboard-filters__item">
                <div>
                  <h4>Release dashboard</h4>
                  <p>
                    Send login credentials and the released month to the
                    organization admin when they have not changed their password.
                  </p>
                </div>
              </div>
            </div>
            <div className="admin-dashboard-filters__actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                disabled={!canRelease}
                onClick={handleRelease}
              >
                {releaseLoading ? "Releasing..." : "Release to organization"}
              </button>
            </div>
            {releaseMessage && (
              <p className="admin-upload-success">{releaseMessage}</p>
            )}
            {releaseError && <p className="admin-upload-error">⚠️ {releaseError}</p>}
          </div>

        </>
      )}
    </div>
  );
}

export { DashboardsPanel };
