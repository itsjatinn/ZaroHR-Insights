import { useEffect, useMemo, useState } from "react";
import {
  FiMail,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiUser,
} from "react-icons/fi";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const avatarSvg = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#0ea5e9"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="80" fill="url(#g)"/>
    <circle cx="80" cy="62" r="26" fill="#0f172a" opacity="0.9"/>
    <path d="M40 130c6-26 28-42 40-42s34 16 40 42" fill="#0f172a" opacity="0.9"/>
  </svg>
`);

type EmployeeSearchItem = {
  id: string;
  name: string;
  empId?: string | null;
  newEmpId?: string | null;
  email?: string | null;
  designation?: string | null;
  entity?: string | null;
};

type EmployeeProfile = {
  id: string;
  name: string;
  empId?: string | null;
  newEmpId?: string | null;
  status?: string | null;
  designation?: string | null;
  role?: string | null;
  function?: string | null;
  department1?: string | null;
  department2?: string | null;
  sbu?: string | null;
  entity?: string | null;
  location?: string | null;
  payrollLocation?: string | null;
  email?: string | null;
  gender?: string | null;
  dob?: string | null;
  doj?: string | null;
  tenure?: number | null;
  age?: number | null;
  reportingManager?: string | null;
  internalGrade?: string | null;
  internalDesignation?: string | null;
  externalDesignation?: string | null;
  position?: string | null;
};

type EducationItem = {
  qualification?: string | null;
  institute?: string | null;
  yearOfPassing?: string | null;
};

type ExperienceItem = {
  organization?: string | null;
  role?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
};

type LtipItem = {
  amount?: number | null;
  ltipDate?: string | null;
  recoveryDate?: string | null;
};

type EmployeeProfileResponse = {
  employee: EmployeeProfile;
  education: EducationItem[];
  experience: ExperienceItem[];
  ltip: LtipItem | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function EmployeeSummary({
  organizationId,
}: {
  organizationId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmployeeProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({
          organizationId,
          query: query.trim(),
        });
        const response = await fetch(
          `${API_BASE_URL}/org/employees/search?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = (await response.json()) as {
          results?: EmployeeSearchItem[];
        };
        setResults(payload.results ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSearchError(
          err instanceof Error ? err.message : "Unable to search employees."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, organizationId]);

  useEffect(() => {
    if (!organizationId || !results.length || selected) return;
    setSelected(null);
  }, [organizationId, results.length, selected]);

  const handleSelect = async (employeeId: string) => {
    if (!organizationId) return;
    setProfileLoading(true);
    try {
      const params = new URLSearchParams({ organizationId });
      const response = await fetch(
        `${API_BASE_URL}/org/employees/${employeeId}?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as EmployeeProfileResponse;
      setSelected(payload);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Unable to load employee profile."
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const employee = selected?.employee ?? null;
  const education = selected?.education ?? [];
  const experience = selected?.experience ?? [];
  const ltip = selected?.ltip ?? null;

  const heroName = employee?.name || "Select an employee";
  const heroRole = employee?.designation || "Search to view employee details";

  const heroSubtitle = useMemo(() => {
    if (!employee) return "Start typing to view employee details.";
    const parts = [
      employee.internalDesignation,
      employee.department1,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Employee profile";
  }, [employee]);
  const showHeroSubtitle =
    heroSubtitle.trim().toLowerCase() !== heroRole.trim().toLowerCase();
  const showSummary = Boolean(selected);
  return (
    <div className="employee-summary">
      <section className="employee-search admin-card">
        <div>
          <h4>Find employee</h4>
          <p className="admin-card__subtitle">
            Search by name, employee ID, or official email.
          </p>
        </div>
        <label className="employee-search__field" aria-label="Search employees">
          <span className="employee-search__icon" aria-hidden="true">
            <FiSearch size={18} />
          </span>
          <input
            type="search"
            placeholder="Search employees..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="employee-search__results">
          {searching && <p className="employee-empty">Searching…</p>}
          {searchError && <p className="employee-empty">{searchError}</p>}
          {!searching && !searchError && query.trim() && !results.length && (
            <p className="employee-empty">No employees found.</p>
          )}
          {!searching &&
            !searchError &&
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="employee-result"
                onClick={() => handleSelect(item.id)}
              >
                <div>
                  <p>{item.name}</p>
                  <span>
                    {(item.empId || item.newEmpId || "ID not set") +
                      " · " +
                      (item.designation || "Role not set")}
                  </span>
                </div>
                <span className="employee-result__meta">
                  {item.entity || "—"}
                </span>
              </button>
            ))}
        </div>
      </section>
      {showSummary && (
        <>
          <section className="employee-hero admin-card">
            <div className="employee-hero__profile">
              <div className="employee-avatar" aria-hidden="true">
                <img
                  src={`data:image/svg+xml;utf8,${avatarSvg}`}
                  alt={`${heroName} avatar`}
                  loading="lazy"
                />
              </div>
              <div>
                <h3>{heroName}</h3>
                <p className="employee-hero__role">
                  {heroRole}
                </p>
                {showHeroSubtitle && (
                  <p className="employee-hero__subtitle">{heroSubtitle}</p>
                )}
                <div className="employee-hero__chips">
                  <span className="employee-chip">
                    {employee?.empId || "EMP-"}
                  </span>
                  <span className="employee-chip">
                    {employee?.entity || "—"}
                  </span>
                  <span className="employee-chip">
                    {employee?.status || "—"}
                  </span>
                  <span className="employee-chip">
                    {employee?.internalGrade || "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="employee-hero__contact">
              <div className="employee-meta">
                <FiMail size={16} aria-hidden="true" />
                <div>
                  <p>Email</p>
                  <span>{employee?.email || "—"}</span>
                </div>
              </div>
              <div className="employee-meta">
                <FiPhone size={16} aria-hidden="true" />
                <div>
                  <p>Phone</p>
                  <span>—</span>
                </div>
              </div>
              <div className="employee-meta">
                <FiMapPin size={16} aria-hidden="true" />
                <div>
                  <p>Location</p>
                  <span>{employee?.location || "—"}</span>
                </div>
              </div>
              <div className="employee-meta">
                <FiUser size={16} aria-hidden="true" />
                <div>
                  <p>Manager</p>
                  <span>{employee?.reportingManager || "—"}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="employee-grid">
        <section className="employee-card admin-card">
          <div className="employee-card__header">
            <div>
              <h4>Personal details</h4>
              <p className="admin-card__subtitle">
                Core profile details stored in the employee master.
              </p>
            </div>
          </div>
          <dl className="employee-kv">
            <div>
              <dt>Employee ID</dt>
              <dd>{employee?.empId || "—"}</dd>
            </div>
            <div>
              <dt>Old Emp ID</dt>
              <dd>{employee?.newEmpId || "—"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{employee?.role || "—"}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{employee?.department2 || "—"}</dd>
            </div>
            <div>
              <dt>Function</dt>
              <dd>{employee?.function || "—"}</dd>
            </div>
            <div>
              <dt>SBU</dt>
              <dd>{employee?.sbu || "—"}</dd>
            </div>
            <div>
              <dt>Entity</dt>
              <dd>{employee?.entity || "—"}</dd>
            </div>
            <div>
              <dt>Payroll Location</dt>
              <dd>{employee?.payrollLocation || "—"}</dd>
            </div>
            <div>
              <dt>Date of Joining</dt>
              <dd>{formatDate(employee?.doj)}</dd>
            </div>
            <div>
              <dt>Tenure</dt>
              <dd>
                {employee?.tenure != null ? `${employee.tenure.toFixed(1)}` : "—"}
              </dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{employee?.age ?? "—"}</dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{employee?.gender || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="employee-card admin-card">
          <div className="employee-card__header">
            <div>
              <h4>Education</h4>
              <p className="admin-card__subtitle">
                Highest qualifications and academic background.
              </p>
            </div>
          </div>
          <div className="employee-timeline">
            {education.length ? (
              education.map((item, index) => (
                <div
                  key={`${item.qualification}-${index}`}
                  className="employee-timeline__item"
                >
                  <p className="employee-timeline__title">
                    {item.qualification || "Qualification not set"}
                  </p>
                  <p className="employee-timeline__meta">
                    {item.institute || "Institute not set"}
                  </p>
                  <span className="employee-timeline__date">
                    {item.yearOfPassing || "—"}
                  </span>
                </div>
              ))
            ) : (
              <p className="employee-empty">No education records available.</p>
            )}
          </div>
        </section>

        <section className="employee-card admin-card">
          <div className="employee-card__header">
            <div>
              <h4>Experience</h4>
              <p className="admin-card__subtitle">
                Previous organizations and roles captured in experience records.
              </p>
            </div>
          </div>
          <div className="employee-timeline">
            {experience.length ? (
              experience.map((item, index) => (
                <div
                  key={`${item.organization}-${item.role}-${index}`}
                  className="employee-timeline__item"
                >
                  <p className="employee-timeline__title">
                    {item.role || "Role not set"}
                  </p>
                  <p className="employee-timeline__meta">
                    {item.organization || "Organization not set"}
                  </p>
                  <span className="employee-timeline__date">
                    {formatDate(item.fromDate)} - {formatDate(item.toDate)}
                  </span>
                </div>
              ))
            ) : (
              <p className="employee-empty">No experience records available.</p>
            )}
          </div>
        </section>

        <section className="employee-card admin-card">
          <div className="employee-card__header">
            <div>
              <h4>LTIP</h4>
              <p className="admin-card__subtitle">
                Long-term incentive plan details (if available).
              </p>
            </div>
          </div>
          {ltip ? (
            <div className="employee-ltip">
              <div>
                <p>Amount</p>
                <span>{ltip.amount != null ? `${ltip.amount}` : "—"}</span>
              </div>
              <div>
                <p>LTIP date</p>
                <span>{formatDate(ltip.ltipDate)}</span>
              </div>
              <div>
                <p>Recovery date</p>
                <span>{formatDate(ltip.recoveryDate)}</span>
              </div>
            </div>
          ) : (
            <p className="employee-empty">No LTIP details available.</p>
          )}
        </section>
          </div>
        </>
      )}
      {profileLoading && (
        <div className="employee-loading">Loading employee profile…</div>
      )}
    </div>
  );
}

export { EmployeeSummary };
