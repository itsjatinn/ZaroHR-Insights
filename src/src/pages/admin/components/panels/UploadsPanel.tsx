import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { Select } from "../ui/Select";
import { useNotifications } from "../notifications/Notifications";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "development" ? "http://localhost:8000" : "/api");

const buildMonthOptions = () => {
  const start = new Date(2025, 7, 1);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const options: { label: string; value: string }[] = [];
  let cursor = end;

  while (cursor >= start) {
    const label = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    options.push({ label, value });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }

  return options;
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

type DashboardPrompt = {
  orgId: string;
  orgLabel: string;
  orgMeta?: string;
  month: string;
  monthLabel: string;
};

interface IngestStats {
  employees: number;
  educations: number;
  experiences: number;
  ltip: number;
  dashboards: number;
  skippedEducation: number;
  skippedExperience: number;
  skippedDashboard: number;
  skippedLtip: number;
}

interface UploadResponse {
  uploadId: string;
  stats: IngestStats;
  raw_stdout?: string | null;
  raw_stderr?: string | null;
}

type Organization = {
  id: string;
  name: string;
  code: string | null;
};

interface UploadsPanelProps {
  onOpenDashboard?: (selection: DashboardPrompt) => void;
}

function UploadsPanel({ onOpenDashboard }: UploadsPanelProps) {
  const { addNotification } = useNotifications();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<DashboardPrompt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [monthOptions, setMonthOptions] = useState(buildMonthOptions);
  const org = organizations.find((item) => item.id === selectedOrg) ?? null;
  const month = monthOptions.find((item) => item.value === selectedMonth) ?? null;

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
    const interval = setInterval(() => {
      setMonthOptions(buildMonthOptions());
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTemplateStatus(null);
  }, [selectedOrg]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setFile(selected ?? null);
    setError(null);
    setResult(null);
    setStatus("idle");
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    setFile(dropped ?? null);
    setError(null);
    setResult(null);
    setStatus("idle");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!org || !month) {
      setError("Select an organization and month before uploading.");
      addNotification({
        title: "Upload blocked",
        message: "Select an organization and month before uploading.",
        type: "warning",
      });
      return;
    }
    if (!file) {
      setError("Please choose an Excel file to upload.");
      addNotification({
        title: "Upload blocked",
        message: "Please choose an Excel file to upload.",
        type: "warning",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("organization_name", org.name);
    formData.append("organization_code", org.code ?? "");
    formData.append("month_key", month.value);
    formData.append("month_label", month.label);

    setStatus("uploading");
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/uploads`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Upload failed (${response.status}).`);
      }

      const payload: UploadResponse = await response.json();
      setResult(payload);
      setStatus("success");
      addNotification({
        title: "Upload complete",
        message: `${org.name} · ${month.label} processed successfully.`,
        type: "success",
      });
      setPrompt({
        orgId: org.id,
        orgLabel: org.name,
        orgMeta: org.code ?? undefined,
        month: month.value,
        monthLabel: month.label,
      });
    } catch (err) {
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "Unknown error occurred.";
      setError(message);
      addNotification({
        title: "Upload failed",
        message,
        type: "error",
      });
    }
  };

  const handleSendTemplate = async () => {
    if (!org) {
      addNotification({
        title: "Template email blocked",
        message: "Select an organization before sending the template.",
        type: "warning",
      });
      return;
    }
    setSendingTemplate(true);
    setTemplateStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/templates/upload/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Unable to send template email.");
      }
      addNotification({
        title: "Template sent",
        message: `Template email sent to ${org.name} admin.`,
        type: "success",
      });
      setTemplateStatus({
        type: "success",
        message: `Template email sent to ${org.name} admin.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to send template email.";
      addNotification({
        title: "Template email failed",
        message,
        type: "error",
      });
      setTemplateStatus({ type: "error", message });
    } finally {
      setSendingTemplate(false);
    }
  };

  return (
    <div className="admin-uploads">
      {orgLoading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Turning data into decisions…</p>
              <p className="dashboard-loading__subtitle">
                Loading upload settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {!orgLoading && (
        <>
          <div className="admin-uploads__header">
            <h3>Data Uploads</h3>
            <p>Upload Excel files with HR data for organizations</p>
          </div>

          <div className="admin-upload-card">
            <div className="admin-dashboard-filters">
              <div className="admin-dashboard-filters__item">
                <div>
                  <h4>Select Organization</h4>
                  <p>Choose which organization to upload data for</p>
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
                  <p>Pick the reporting month for this upload</p>
                </div>
                <Select
                  options={monthOptions}
                  value={selectedMonth}
                  placeholder="Select a month"
                  onChange={setSelectedMonth}
                />
              </div>
            </div>
            {orgError && <p className="admin-upload-error">⚠️ {orgError}</p>}
            <div className="admin-upload-subcard admin-template-card">
              <div className="admin-template-card__header">
                <div>
                  <h4>Templates</h4>
                  <p>Download or email the HR upload template</p>
                </div>
                <div className="admin-template-card__actions">
                  <a
                    className="admin-button admin-button--ghost"
                    href={`${API_BASE_URL}/templates/upload`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    Download Template
                  </a>
                  <button
                    type="button"
                    className="admin-button admin-button--primary"
                    onClick={handleSendTemplate}
                    disabled={sendingTemplate || !org}
                  >
                    {sendingTemplate ? "Sending…" : "Email to Org Admin"}
                  </button>
                </div>
              </div>
              {templateStatus && (
                <div className="admin-template-status-row">
                  <p
                    className={`admin-template-status ${
                      templateStatus.type === "success"
                        ? "admin-template-status--success"
                        : "admin-template-status--error"
                    }`}
                  >
                    {templateStatus.type === "error" && "⚠️ "}
                    {templateStatus.message}
                  </p>
                </div>
              )}
            </div>
          </div>

          <form
            className="admin-dropzone"
            onSubmit={handleSubmit}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="admin-upload-input"
            />
            <div className="admin-dropzone__icon" aria-hidden="true">
              <FiUploadCloud size={22} />
            </div>
            <h4>Upload Excel Files</h4>
            <p>Drag and drop or use the button to browse</p>
            <span>Supports .xlsx, .xls files</span>
            <div className="admin-upload-actions">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={handleBrowse}
              >
                Browse Files
              </button>
              <button
                type="submit"
                className="admin-button admin-button--primary admin-upload-actions__primary"
                disabled={status === "uploading"}
              >
                {status === "uploading" ? "Uploading…" : "Upload"}
              </button>
            </div>
            {file && <p className="admin-upload-file">Selected: {file.name}</p>}
            {error && <p className="admin-upload-error">⚠️ {error}</p>}
          </form>

          {result && (
            <div className="admin-upload-card admin-upload-result">
              <h4>Upload Result</h4>
              <dl className="admin-upload-stats">
                {Object.entries(result.stats).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="admin-upload-meta">
                <span>Upload ID</span>
                <code>{result.uploadId}</code>
              </div>
              {result.raw_stderr && (
                <div className="admin-upload-meta admin-upload-meta--warning">
                  <span>stderr</span>
                  <pre>{result.raw_stderr}</pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {prompt && (
        <div className="admin-modal">
          <div className="admin-modal__card">
            <div>
              <h4>Upload complete</h4>
              <p className="admin-card__subtitle">
                View the dashboard for {prompt.orgLabel} · {prompt.monthLabel}?
              </p>
            </div>
            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={() => setPrompt(null)}
              >
                Maybe later
              </button>
              <button
                type="button"
                className="admin-button admin-button--primary"
                onClick={() => {
                  if (onOpenDashboard) {
                    onOpenDashboard(prompt);
                  } else {
                    const params = new URLSearchParams({
                      view: "dashboard",
                      orgId: prompt.orgId,
                      orgLabel: prompt.orgLabel,
                      orgMeta: prompt.orgMeta ?? "",
                      month: prompt.month,
                      monthLabel: prompt.monthLabel,
                    });
                    window.open(
                      `${window.location.origin}?${params.toString()}`,
                      "_blank",
                      "noopener"
                    );
                  }
                  setPrompt(null);
                }}
              >
                View dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { UploadsPanel };
