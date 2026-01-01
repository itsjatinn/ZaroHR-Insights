import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { FiBriefcase, FiFileText, FiUsers } from "react-icons/fi";
import { useNotifications } from "../notifications/Notifications";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

type Organization = {
  id: string;
  name: string;
  code: string | null;
  uploads: number;
};

function OrganizationsPanel() {
  const { addNotification } = useNotifications();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      setOrganizations(payload.organizations ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load organizations.";
      setListError(message);
      addNotification({
        title: "Organization load failed",
        message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Organization name is required.");
      return;
    }
    if (!editingOrg && !adminEmail.trim()) {
      setError("Org admin email is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        editingOrg
          ? `${API_BASE_URL}/organizations/${editingOrg.id}`
          : `${API_BASE_URL}/organizations`,
        {
          method: editingOrg ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim() || null,
            admin_name: adminName.trim() || null,
            admin_email: adminEmail.trim() || null,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      addNotification({
        title: editingOrg ? "Organization updated" : "Organization created",
        message: `${payload.name || name.trim()} was ${
          editingOrg ? "updated" : "added"
        } successfully.`,
        type: "success",
      });
      setOrganizations((prev) =>
        editingOrg
          ? prev.map((item) => (item.id === payload.id ? payload : item))
          : [payload, ...prev]
      );
      setName("");
      setCode("");
      setAdminName("");
      setAdminEmail("");
      setEditingOrg(null);
      setShowForm(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save organization.";
      setError(message);
      addNotification({
        title: editingOrg ? "Organization update failed" : "Organization create failed",
        message,
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (org: Organization) => {
    if (isDeleting) return;
    const confirmed = window.confirm(
      `Delete ${org.name}? This will remove all related data.`
    );
    if (!confirmed) return;

    setIsDeleting(org.id);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${org.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOrganizations((prev) => prev.filter((item) => item.id !== org.id));
      addNotification({
        title: "Organization deleted",
        message: `${org.name} and related data were removed.`,
        type: "success",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to delete organization.";
      addNotification({
        title: "Organization delete failed",
        message,
        type: "error",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleForm = () => {
    if (showForm) {
      setShowForm(false);
      setEditingOrg(null);
      setError(null);
      return;
    }
    setShowForm(true);
    setEditingOrg(null);
    setName("");
    setCode("");
    setAdminName("");
    setAdminEmail("");
    setError(null);
  };

  const handleEdit = async (org: Organization) => {
    setShowForm(true);
    setEditingOrg(org);
    setName(org.name);
    setCode(org.code ?? "");
    setAdminName("");
    setAdminEmail("");
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${org.id}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as {
        admin_name?: string | null;
        admin_email?: string | null;
      };
      setAdminName(payload.admin_name ?? "");
      setAdminEmail(payload.admin_email ?? "");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load admin details.";
      setError(message);
      addNotification({
        title: "Organization load failed",
        message,
        type: "error",
      });
    }
  };

  return (
    <div className="admin-orgs">
      {isLoading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Turning data into decisions…</p>
              <p className="dashboard-loading__subtitle">
                Loading organizations.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isLoading && listError && (
        <div className="admin-upload-card">
          <p className="admin-upload-error">⚠️ {listError}</p>
        </div>
      )}

      {!isLoading && !listError && (
        <>
          <div className="admin-orgs__header">
            <div>
              <h3>All Organizations</h3>
              <p className="admin-card__subtitle">
                Manage organizations and their HR data
              </p>
            </div>
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={handleToggleForm}
            >
              {showForm ? "Close" : "+ Add Organization"}
            </button>
          </div>

          {showForm && (
            <div className="admin-upload-card admin-org-form">
              <div>
                <h4>{editingOrg ? "Edit Organization" : "Add Organization"}</h4>
                <p>
                  {editingOrg
                    ? "Update organization details."
                    : "Save a new organization for uploads and dashboards."}
                </p>
              </div>
              <form className="admin-org-form__fields" onSubmit={handleSubmit}>
                <label className="admin-org-form__field">
                  <span>Name</span>
                  <input
                    className="admin-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Organization name"
                  />
                </label>
                <label className="admin-org-form__field">
                  <span>Sector</span>
                  <input
                    className="admin-input"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Organisation sector"
                  />
                </label>
                <label className="admin-org-form__field">
                  <span>Org admin name</span>
                  <input
                    className="admin-input"
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                    placeholder="Admin name (optional)"
                  />
                </label>
                <label className="admin-org-form__field">
                  <span>Org admin email</span>
                  <input
                    className="admin-input"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="admin@company.com"
                    type="email"
                    required={!editingOrg}
                  />
                </label>
                <div className="admin-org-form__actions">
                  <button
                    type="submit"
                    className="admin-button admin-button--primary"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? editingOrg
                        ? "Updating..."
                        : "Saving..."
                      : editingOrg
                      ? "Update Organization"
                      : "Save Organization"}
                  </button>
                </div>
              </form>
              {error && <p className="admin-upload-error">⚠️ {error}</p>}
            </div>
          )}

          <div className="admin-orgs__grid">
            {organizations.map((org) => (
              <div key={org.id} className="admin-org-card">
                <div className="admin-org-card__top">
                  <span className="admin-org-card__icon" aria-hidden="true">
                    <FiBriefcase size={22} />
                  </span>
                  <div>
                    <p className="admin-org-card__title">{org.name}</p>
                    <p className="admin-org-card__subtitle">
                      {org.code || "No sector yet"}
                    </p>
                  </div>
                </div>

                <div className="admin-org-card__stats">
                  <div className="admin-org-card__stat">
                    <div className="admin-org-card__stat-label">
                      <FiUsers size={16} aria-hidden="true" />
                      Sector
                    </div>
                    <strong>{org.code || "—"}</strong>
                  </div>
                  <div className="admin-org-card__stat">
                    <div className="admin-org-card__stat-label">
                      <FiFileText size={16} aria-hidden="true" />
                      Uploads
                    </div>
                    <strong>{org.uploads}</strong>
                  </div>
                </div>

                <p className="admin-org-card__meta">Saved in database</p>
                <div className="admin-org-card__actions">
                  <button
                    type="button"
                    className="admin-button admin-button--ghost"
                    onClick={() => handleEdit(org)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-button admin-button--danger"
                    onClick={() => handleDelete(org)}
                    disabled={isDeleting === org.id}
                  >
                    {isDeleting === org.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { OrganizationsPanel };
