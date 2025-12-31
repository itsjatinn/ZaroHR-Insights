import { useEffect, useState } from "react";
import { EmployeeSummary } from "../../../OrganisationAdmin/panels/EmployeeSummary";
import { Select } from "../ui/Select";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type Organization = {
  id: string;
  name: string;
  code: string | null;
};

function EmployeeSummaryPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

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

  return (
    <div className="admin-uploads">
      {orgLoading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Loading organizations…</p>
              <p className="dashboard-loading__subtitle">
                Preparing employee summary search.
              </p>
            </div>
          </div>
        </div>
      )}

      {!orgLoading && (
        <>
          <div className="admin-uploads__header">
            <h3>Employee Summary</h3>
            <p>Pick an organization to search employee profiles</p>
          </div>

          <div className="admin-upload-card">
            <div className="admin-dashboard-filters">
              <div className="admin-dashboard-filters__item">
                <div>
                  <h4>Select Organization</h4>
                  <p>Choose which organization to search</p>
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
            </div>
            {orgError && <p className="admin-upload-error">⚠️ {orgError}</p>}
          </div>

          {selectedOrg ? (
            <EmployeeSummary organizationId={selectedOrg} />
          ) : (
            <p className="employee-empty">
              Select an organization to view employee details.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export { EmployeeSummaryPanel };
