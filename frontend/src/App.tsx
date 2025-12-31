import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
  RefObject,
} from "react";
import "./App.css";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
  LabelList,
  LineChart,
  Line,
} from "recharts";
import type { LabelFormatter } from "recharts/types/component/Label";
import { format, parseISO } from "date-fns";
import { toPng } from "html-to-image";
import AdminPage from "./pages/admin/page";
import { OrgAdminPanel } from "./pages/OrganisationAdmin/OrgAdminPanel";
import LandingPage from "./pages/Landingpage/page";
import LoginPage from "./pages/Landingpage/LoginPage";
import ForgotPasswordPage from "./pages/Landingpage/ForgotPasswordPage";
import ResetPasswordPage from "./pages/Landingpage/ResetPasswordPage";
import ContactPage from "./pages/Contact/page";
import type { DashboardSelection } from "./pages/admin/components/panels/DashboardsPanel";
import { Select } from "./pages/admin/components/ui/Select";
import { DatePicker } from "./components/DatePicker";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DASHBOARD_SELECTION_KEY = "hrdash:dashboardSelection";
const DASHBOARD_CONFIG_KEY_PREFIX = "hrdash:dashboardConfig:";

const DEFAULT_CHART_MIN_HEIGHT = 320;
const COMPACT_CHART_MIN_HEIGHT = 260;

const tooltipContentStyle: CSSProperties = {
  backgroundColor: "#0f172a",
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.25)",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.45)",
  color: "#f8fafc",
  padding: "0.9rem 1rem",
};

const tooltipLabelStyle: CSSProperties = {
  color: "#fbbf24",
  fontWeight: 700,
  fontSize: "0.9rem",
  marginBottom: 6,
};

const tooltipItemStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "0.85rem",
  letterSpacing: "0.01em",
};

type Granularity = "monthly" | "quarterly" | "yearly";

interface ManpowerPoint {
  periodStart: string;
  headcount: number;
  openingHeadcount: number;
  rampChange: number;
  rampPct: number;
}

interface HireExitPoint {
  periodStart: string;
  hires: number;
  exits: number;
}

interface WorkLevelStats {
  worklevel: string;
  headcount: number;
  headcountPct: number;
  costPct: number;
  femalePct: number;
  avgTenure: number | null;
  avgAge: number | null;
  isTotal?: boolean;
}

interface DemographicsResponse {
  granularity: Granularity;
  start: string;
  end: string;
  averages: {
    ctc: number | null;
    age: number | null;
    tenure: number | null;
  };
  genderRatio: {
    male: number;
    female: number;
    other: number;
  };
  worklevels: WorkLevelStats[];
}

interface EntityStats {
  entity: string | null;
  headcount: number;
  headcountPct: number;
  costPct: number;
  femalePct: number;
  avgTenure: number | null;
  avgAge: number | null;
  label: string;
}

interface EntityDemographicsResponse {
  granularity: Granularity;
  start: string;
  end: string;
  entities: EntityStats[];
}

interface AttritionPoint {
  label: string;
  attritionPct: number;
}

interface EntityAttritionPoint extends AttritionPoint {
  entity: string;
}

interface AgeGroupPoint {
  label: string;
  twentyPct: number;
  thirtyPct: number;
  fortyPct: number;
  fiftyPct: number;
}

interface GenderTrendPoint {
  label: string;
  malePct: number;
  femalePct: number;
}

interface TenureTrendPoint {
  label: string;
  zeroSixPct: number;
  sixTwelvePct: number;
  oneTwoPct: number;
  twoFourPct: number;
  fourTenPct: number;
  tenPlusPct: number;
}

interface AttritionResponse {
  overall: AttritionPoint[];
  entities: EntityAttritionPoint[];
  ageTrend: AgeGroupPoint[];
  genderTrend: GenderTrendPoint[];
  tenureTrend: TenureTrendPoint[];
}

type AiSummaryResponse = {
  dashboardSummary: string;
  chartSummaries: Record<string, string>;
};

const DEMO_ENTITIES = [
  "North Hub",
  "South Hub",
  "West Zone",
  "East Zone",
  "Head Office",
];

const DEMO_MANPOWER_DATA: ManpowerPoint[] = [
  {
    periodStart: "2024-01-01",
    headcount: 2380,
    openingHeadcount: 2320,
    rampChange: 60,
    rampPct: 60 / 2320,
  },
  {
    periodStart: "2024-02-01",
    headcount: 2445,
    openingHeadcount: 2380,
    rampChange: 65,
    rampPct: 65 / 2380,
  },
  {
    periodStart: "2024-03-01",
    headcount: 2515,
    openingHeadcount: 2445,
    rampChange: 70,
    rampPct: 70 / 2445,
  },
  {
    periodStart: "2024-04-01",
    headcount: 2570,
    openingHeadcount: 2515,
    rampChange: 55,
    rampPct: 55 / 2515,
  },
  {
    periodStart: "2024-05-01",
    headcount: 2628,
    openingHeadcount: 2570,
    rampChange: 58,
    rampPct: 58 / 2570,
  },
  {
    periodStart: "2024-06-01",
    headcount: 2680,
    openingHeadcount: 2628,
    rampChange: 52,
    rampPct: 52 / 2628,
  },
  {
    periodStart: "2024-07-01",
    headcount: 2708,
    openingHeadcount: 2680,
    rampChange: 28,
    rampPct: 28 / 2680,
  },
  {
    periodStart: "2024-08-01",
    headcount: 2740,
    openingHeadcount: 2708,
    rampChange: 32,
    rampPct: 32 / 2708,
  },
];

const DEMO_HIRE_DATA: HireExitPoint[] = [
  { periodStart: "2024-01-01", hires: 118, exits: 68 },
  { periodStart: "2024-02-01", hires: 126, exits: 72 },
  { periodStart: "2024-03-01", hires: 134, exits: 75 },
  { periodStart: "2024-04-01", hires: 120, exits: 65 },
  { periodStart: "2024-05-01", hires: 128, exits: 70 },
  { periodStart: "2024-06-01", hires: 122, exits: 64 },
  { periodStart: "2024-07-01", hires: 110, exits: 78 },
  { periodStart: "2024-08-01", hires: 116, exits: 69 },
];

const DEMO_DEMOGRAPHICS: DemographicsResponse = {
  granularity: "monthly",
  start: "2024-01-01",
  end: "2024-08-01",
  averages: {
    ctc: 1450000,
    age: 32.4,
    tenure: 4.1,
  },
  genderRatio: {
    male: 0.56,
    female: 0.42,
    other: 0.02,
  },
  worklevels: [
    {
      worklevel: "Top",
      headcount: 180,
      headcountPct: 0.07,
      costPct: 0.22,
      femalePct: 0.28,
      avgTenure: 9.2,
      avgAge: 41.3,
    },
    {
      worklevel: "Senior",
      headcount: 520,
      headcountPct: 0.19,
      costPct: 0.32,
      femalePct: 0.35,
      avgTenure: 6.4,
      avgAge: 36.8,
    },
    {
      worklevel: "Mid",
      headcount: 1040,
      headcountPct: 0.38,
      costPct: 0.30,
      femalePct: 0.44,
      avgTenure: 3.8,
      avgAge: 31.1,
    },
    {
      worklevel: "Junior",
      headcount: 920,
      headcountPct: 0.36,
      costPct: 0.16,
      femalePct: 0.49,
      avgTenure: 2.1,
      avgAge: 27.8,
    },
    {
      worklevel: "Total",
      headcount: 2660,
      headcountPct: 1,
      costPct: 1,
      femalePct: 0.42,
      avgTenure: 4.1,
      avgAge: 32.4,
      isTotal: true,
    },
  ],
};

const DEMO_ENTITY_DEMOGRAPHICS: EntityDemographicsResponse = {
  granularity: "monthly",
  start: "2024-01-01",
  end: "2024-08-01",
  entities: [
    {
      entity: "North Hub",
      label: "North Hub",
      headcount: 720,
      headcountPct: 0.27,
      costPct: 0.25,
      femalePct: 0.4,
      avgTenure: 4.6,
      avgAge: 33.2,
    },
    {
      entity: "South Hub",
      label: "South Hub",
      headcount: 610,
      headcountPct: 0.23,
      costPct: 0.22,
      femalePct: 0.44,
      avgTenure: 4.2,
      avgAge: 32.8,
    },
    {
      entity: "West Zone",
      label: "West Zone",
      headcount: 520,
      headcountPct: 0.2,
      costPct: 0.19,
      femalePct: 0.39,
      avgTenure: 3.9,
      avgAge: 31.7,
    },
    {
      entity: "East Zone",
      label: "East Zone",
      headcount: 480,
      headcountPct: 0.18,
      costPct: 0.18,
      femalePct: 0.46,
      avgTenure: 3.6,
      avgAge: 30.8,
    },
    {
      entity: "Head Office",
      label: "Head Office",
      headcount: 330,
      headcountPct: 0.12,
      costPct: 0.16,
      femalePct: 0.5,
      avgTenure: 5.1,
      avgAge: 34.5,
    },
  ],
};

const DEMO_ATTRITION: AttritionResponse = {
  overall: [
    { label: "Jan", attritionPct: 0.031 },
    { label: "Feb", attritionPct: 0.028 },
    { label: "Mar", attritionPct: 0.034 },
    { label: "Apr", attritionPct: 0.026 },
    { label: "May", attritionPct: 0.03 },
    { label: "Jun", attritionPct: 0.025 },
  ],
  entities: [
    { entity: "North Hub", label: "North Hub", attritionPct: 0.027 },
    { entity: "South Hub", label: "South Hub", attritionPct: 0.029 },
    { entity: "West Zone", label: "West Zone", attritionPct: 0.033 },
    { entity: "East Zone", label: "East Zone", attritionPct: 0.024 },
    { entity: "Head Office", label: "Head Office", attritionPct: 0.021 },
  ],
  ageTrend: [
    { label: "Jan", twentyPct: 0.1, thirtyPct: 0.12, fortyPct: 0.08, fiftyPct: 0.05 },
    { label: "Feb", twentyPct: 0.09, thirtyPct: 0.11, fortyPct: 0.07, fiftyPct: 0.05 },
    { label: "Mar", twentyPct: 0.11, thirtyPct: 0.13, fortyPct: 0.08, fiftyPct: 0.06 },
    { label: "Apr", twentyPct: 0.08, thirtyPct: 0.1, fortyPct: 0.07, fiftyPct: 0.04 },
    { label: "May", twentyPct: 0.09, thirtyPct: 0.11, fortyPct: 0.07, fiftyPct: 0.05 },
    { label: "Jun", twentyPct: 0.08, thirtyPct: 0.1, fortyPct: 0.06, fiftyPct: 0.04 },
  ],
  genderTrend: [
    { label: "Jan", malePct: 0.018, femalePct: 0.013 },
    { label: "Feb", malePct: 0.017, femalePct: 0.011 },
    { label: "Mar", malePct: 0.02, femalePct: 0.014 },
    { label: "Apr", malePct: 0.016, femalePct: 0.01 },
    { label: "May", malePct: 0.018, femalePct: 0.012 },
    { label: "Jun", malePct: 0.015, femalePct: 0.01 },
  ],
  tenureTrend: [
    {
      label: "Jan",
      zeroSixPct: 0.04,
      sixTwelvePct: 0.03,
      oneTwoPct: 0.025,
      twoFourPct: 0.02,
      fourTenPct: 0.018,
      tenPlusPct: 0.012,
    },
    {
      label: "Feb",
      zeroSixPct: 0.038,
      sixTwelvePct: 0.028,
      oneTwoPct: 0.024,
      twoFourPct: 0.019,
      fourTenPct: 0.017,
      tenPlusPct: 0.011,
    },
    {
      label: "Mar",
      zeroSixPct: 0.045,
      sixTwelvePct: 0.031,
      oneTwoPct: 0.026,
      twoFourPct: 0.021,
      fourTenPct: 0.019,
      tenPlusPct: 0.013,
    },
    {
      label: "Apr",
      zeroSixPct: 0.036,
      sixTwelvePct: 0.027,
      oneTwoPct: 0.023,
      twoFourPct: 0.018,
      fourTenPct: 0.016,
      tenPlusPct: 0.01,
    },
    {
      label: "May",
      zeroSixPct: 0.039,
      sixTwelvePct: 0.029,
      oneTwoPct: 0.024,
      twoFourPct: 0.019,
      fourTenPct: 0.017,
      tenPlusPct: 0.011,
    },
    {
      label: "Jun",
      zeroSixPct: 0.035,
      sixTwelvePct: 0.026,
      oneTwoPct: 0.022,
      twoFourPct: 0.017,
      fourTenPct: 0.015,
      tenPlusPct: 0.01,
    },
  ],
};

const DEMO_AI_SUMMARY: AiSummaryResponse = {
  dashboardSummary:
    "Headcount and hiring remain healthy with steady growth, while attrition stays under control across entities.",
  chartSummaries: {
    manpower_rampup:
      "Manpower continues to rise month-over-month, with the strongest uplift in Q1.",
    hires_exits:
      "Hiring outpaces exits throughout the period, keeping net change positive.",
    worklevel_overview:
      "Mid and junior levels hold the largest share of headcount, with balanced cost distribution.",
    entity_overview:
      "North and South hubs lead total headcount, while the head office has the highest tenure.",
    overall_attrition:
      "Attrition peaks in March but trends downward into June.",
    entity_attrition:
      "West Zone shows the highest attrition among entities, while head office stays lowest.",
    age_attrition:
      "Attrition is most pronounced in the 30+ group, with stable 50+ exits.",
    gender_attrition:
      "Male attrition trends slightly higher than female each month.",
    tenure_attrition:
      "Early-tenure exits are the largest share, indicating onboarding focus areas.",
  },
};

function AiSummaryInsight({ text }: { text: string }) {
  return (
    <div className="chart-insight" role="note">
      <span className="insight-icon" aria-hidden="true">
        ✨
      </span>
      <div className="insight-body">
        <p>{text}</p>
      </div>
    </div>
  );
}

function CopyChartButton({
  targetRef,
  label,
}: {
  targetRef: RefObject<HTMLElement | null>;
  label: string;
}) {
  const [isCopying, setIsCopying] = useState(false);
  const handleCopy = useCallback(async () => {
    const node = targetRef.current;
    if (!node) {
      return;
    }
    node.classList.add("copying");
    setIsCopying(true);
    try {
      const dataUrl = await toPng(node, { cacheBust: true, backgroundColor: "#fff" });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const ClipboardItemCtor = (window as any).ClipboardItem;
      if (navigator.clipboard && ClipboardItemCtor) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({
            [blob.type]: blob,
          }),
        ]);
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${label.replace(/[^a-z0-9]+/gi, "_") || "chart"}.png`;
        link.click();
      }
    } catch (error) {
      console.error("Unable to copy chart image", error);
    } finally {
      setIsCopying(false);
      node?.classList.remove("copying");
    }
  }, [label, targetRef]);

  return (
    <button
      type="button"
      className="chart-copy-button"
      onClick={handleCopy}
      disabled={isCopying}
    >
      <span className="copy-clipboard-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          role="presentation"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M9 7.5h7.25a1.75 1.75 0 0 1 1.75 1.75V18a1.5 1.5 0 0 1-1.5 1.5H9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5.75A1.75 1.75 0 0 0 4 5.25V15a1.5 1.5 0 0 0 1.5 1.5h2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {isCopying ? "Copying…" : "Copy chart"}
    </button>
  );
}

type View =
  | "landing"
  | "demo"
  | "dashboard"
  | "admin"
  | "org-admin"
  | "contact"
  | "login"
  | "forgot"
  | "reset"
  | "signup";

type ChartKey =
  | "manpower_rampup"
  | "hires_exits"
  | "worklevel_overview"
  | "entity_overview"
  | "overall_attrition"
  | "entity_attrition"
  | "age_attrition"
  | "gender_attrition"
  | "tenure_attrition";

type ChartConfig = Record<ChartKey, boolean>;

const buildDefaultChartConfig = (): ChartConfig => ({
  manpower_rampup: true,
  hires_exits: true,
  worklevel_overview: true,
  entity_overview: true,
  overall_attrition: true,
  entity_attrition: true,
  age_attrition: true,
  gender_attrition: true,
  tenure_attrition: true,
});

type HistoryState = {
  view: View;
  dashboardSelection?: DashboardSelection | null;
  selectedOrganizationId?: string | null;
  selectedMonthKey?: string | null;
};

function App() {
  const [view, setView] = useState<View>("landing");
  const isDemo = view === "demo";
  const shouldLoadAnalytics = view === "dashboard" || view === "demo";
  const [roleOverride, setRoleOverride] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("role");
  });
  const [dashboardSelection, setDashboardSelection] =
    useState<DashboardSelection | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [manpowerData, setManpowerData] = useState<ManpowerPoint[]>([]);
  const [hireData, setHireData] = useState<HireExitPoint[]>([]);
  const [demographics, setDemographics] =
    useState<DemographicsResponse | null>(null);
  const [entityDemographics, setEntityDemographics] =
    useState<EntityDemographicsResponse | null>(null);
  const [attritionData, setAttritionData] = useState<AttritionResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiSummaryResponse | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [entities, setEntities] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(
    null
  );
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [chartConfig, setChartConfig] = useState<ChartConfig>(
    buildDefaultChartConfig
  );

  const applyDemoData = useCallback(() => {
    setManpowerData(DEMO_MANPOWER_DATA);
    setHireData(DEMO_HIRE_DATA);
    setDemographics(DEMO_DEMOGRAPHICS);
    setEntityDemographics(DEMO_ENTITY_DEMOGRAPHICS);
    setAttritionData(DEMO_ATTRITION);
  }, []);

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name?: string | null;
    email: string;
    role: string;
    organizationId?: string | null;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const savedUser = window.localStorage.getItem("hrdash:user");
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser) as {
        id: string;
        name?: string | null;
        email: string;
        role: string;
        organizationId?: string | null;
      };
    } catch {
      window.localStorage.removeItem("hrdash:user");
      return null;
    }
  });
  useEffect(() => {
    if (!isDemo) {
      return;
    }
    setAnalyticsError(null);
    setAiSummary(DEMO_AI_SUMMARY);
    setAiSummaryError(null);
    setAnalyticsLoading(false);
    setEntities(DEMO_ENTITIES);
    setEntityError(null);
    setEntityLoading(false);
    applyDemoData();
  }, [applyDemoData, isDemo]);
  const persistedRole =
    typeof window !== "undefined"
      ? (() => {
          const stored = window.localStorage.getItem("hrdash:user");
          if (!stored) return null;
          try {
            return (JSON.parse(stored) as { role?: string }).role ?? null;
          } catch {
            return null;
          }
        })()
      : null;
  const showAllChartsForAdmin =
    currentUser?.role === "ADMIN" ||
    roleOverride === "ADMIN" ||
    persistedRole === "ADMIN";
  const effectiveChartConfig = showAllChartsForAdmin
    ? {
        manpower_rampup: true,
        hires_exits: true,
        worklevel_overview: true,
        entity_overview: true,
        overall_attrition: true,
        entity_attrition: true,
        age_attrition: true,
        gender_attrition: true,
        tenure_attrition: true,
      }
    : chartConfig;
  const resolvedOrganizationId =
    selectedOrganizationId ??
    dashboardSelection?.orgId ??
    currentUser?.organizationId ??
    null;
  const resolvedMonthKey = selectedMonthKey ?? dashboardSelection?.month ?? null;
  const bootstrappedRef = useRef(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const bodyOverflowRef = useRef<string | null>(null);
  const manpowerCopyRef = useRef<HTMLDivElement>(null);
  const hiresCopyRef = useRef<HTMLDivElement>(null);
  const worklevelCopyRef = useRef<HTMLDivElement>(null);
  const overallAttritionCopyRef = useRef<HTMLDivElement>(null);
  const entityAttritionCopyRef = useRef<HTMLDivElement>(null);
  const entityHcCopyRef = useRef<HTMLDivElement>(null);
  const ageCopyRef = useRef<HTMLDivElement>(null);
  const genderCopyRef = useRef<HTMLDivElement>(null);
  const tenureCopyRef = useRef<HTMLDivElement>(null);

  const navigate = (
    nextView: View,
    options?: {
      dashboardSelection?: DashboardSelection | null;
      replace?: boolean;
    }
  ) => {
    setView(nextView);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (nextView !== "landing") {
      params.set("view", nextView);
    }
    const selection = options?.dashboardSelection ?? dashboardSelection;
    if (nextView === "dashboard" && selection) {
      params.set("orgId", selection.orgId);
      params.set("orgLabel", selection.orgLabel);
      params.set("orgMeta", selection.orgMeta ?? "");
      params.set("month", selection.month);
      params.set("monthLabel", selection.monthLabel);
    }
    if (nextView === "reset") {
      const token = new URLSearchParams(window.location.search).get("token");
      if (token) {
        params.set("token", token);
      }
    }
    const url = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    const state: HistoryState = {
      view: nextView,
      dashboardSelection: selection ?? null,
      selectedOrganizationId,
      selectedMonthKey,
    };
    if (options?.replace) {
      window.history.replaceState(state, "", url);
    } else {
      window.history.pushState(state, "", url);
    }
  };

  const handleOpenDashboard = (selection: DashboardSelection) => {
    const params = new URLSearchParams({
      view: "dashboard",
      orgId: selection.orgId,
      orgLabel: selection.orgLabel,
      orgMeta: selection.orgMeta ?? "",
      month: selection.month,
      monthLabel: selection.monthLabel,
    });
    params.set("role", currentUser?.role ?? "ADMIN");
    window.open(
      `${window.location.origin}?${params.toString()}`,
      "_blank",
      "noopener"
    );
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    window.localStorage.removeItem("hrdash:user");
    navigate("login", { replace: true });
  };

  const fetchEntityOptions = async () => {
    if (!shouldLoadAnalytics) {
      return;
    }
    if (isDemo) {
      setEntities(DEMO_ENTITIES);
      setEntityLoading(false);
      setEntityError(null);
      return;
    }
    setEntityLoading(true);
    setEntityError(null);
    try {
      const params = new URLSearchParams();
      if (resolvedOrganizationId) {
        params.set("organization_id", resolvedOrganizationId);
      }
      if (resolvedMonthKey) {
        params.set("month_key", resolvedMonthKey);
      }
      const urlSuffix = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/analytics/entities${urlSuffix ? `?${urlSuffix}` : ""}`
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      setEntities(payload.entities ?? []);
    } catch (err) {
      setEntityError(
        err instanceof Error ? err.message : "Unable to load entities."
      );
    } finally {
      setEntityLoading(false);
    }
  };

  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (typeof window === "undefined") return;
    const applyFromUrl = (search: string) => {
      const params = new URLSearchParams(search);
      const viewParam = params.get("view");
      let nextView: View = "landing";
      if (viewParam && viewParam !== "dashboard") {
        if (
          viewParam === "landing" ||
          viewParam === "demo" ||
          viewParam === "contact" ||
          viewParam === "login" ||
          viewParam === "signup" ||
          viewParam === "forgot" ||
          viewParam === "reset" ||
          viewParam === "admin" ||
          viewParam === "org-admin"
        ) {
          nextView = viewParam === "signup" ? "login" : viewParam;
        }
      } else if (viewParam === "dashboard") {
        const orgId = params.get("orgId");
        const orgLabel = params.get("orgLabel") ?? orgId ?? "Organization";
        const orgMeta = params.get("orgMeta") || undefined;
        const month = params.get("month");
        const monthLabel = params.get("monthLabel") ?? month ?? "Month";
        const roleParam = params.get("role");
        setRoleOverride(roleParam || null);
        if (orgId && month) {
          setDashboardSelection({
            orgId,
            orgLabel,
            orgMeta,
            month,
            monthLabel,
          });
          setGranularity("monthly");
          setStartDate("");
          setEndDate("");
          setSelectedEntity("");
          setSelectedOrganizationId(orgId);
          setSelectedMonthKey(month);
          nextView = "dashboard";
        } else {
          const stored = window.localStorage.getItem(DASHBOARD_SELECTION_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as DashboardSelection;
              if (parsed.orgId && parsed.month) {
                setDashboardSelection(parsed);
                setSelectedOrganizationId(parsed.orgId);
                setSelectedMonthKey(parsed.month);
                nextView = "dashboard";
              }
            } catch {
              window.localStorage.removeItem(DASHBOARD_SELECTION_KEY);
            }
          }
        }
      }
      return nextView;
    };

    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const initialState = window.history.state as HistoryState | null;
    let resolvedView: View;

    if (initialState?.view) {
      resolvedView = initialState.view;
      setDashboardSelection(initialState.dashboardSelection ?? null);
      setSelectedOrganizationId(initialState.selectedOrganizationId ?? null);
      setSelectedMonthKey(initialState.selectedMonthKey ?? null);
    } else {
      resolvedView = applyFromUrl(window.location.search);
    }

    const savedUser = window.localStorage.getItem("hrdash:user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as {
          id: string;
          name?: string | null;
          email: string;
          role: string;
          organizationId?: string | null;
        };
        setCurrentUser(parsed);
        if (!viewParam) {
          resolvedView = parsed.role === "ADMIN" ? "admin" : "org-admin";
        }
      } catch {
        window.localStorage.removeItem("hrdash:user");
      }
    }

    setView(resolvedView);
    window.history.replaceState(
      { view: resolvedView } as HistoryState,
      "",
      `${window.location.pathname}${window.location.search}`
    );

    const handlePopState = () => {
      const nextView = applyFromUrl(window.location.search);
      setView(nextView);
    };

    window.addEventListener("popstate", handlePopState);
    bootstrappedRef.current = true;
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!dashboardSelection) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DASHBOARD_SELECTION_KEY,
      JSON.stringify(dashboardSelection)
    );
  }, [dashboardSelection]);

  useEffect(() => {
    if (!shouldLoadAnalytics) {
      return;
    }
    fetchEntityOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, resolvedOrganizationId, resolvedMonthKey, shouldLoadAnalytics]);

  const fetchAnalytics = async () => {
    if (!shouldLoadAnalytics) {
      return;
    }
    if (isDemo) {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      setAiSummary(null);
      setAiSummaryError(null);
      applyDemoData();
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    setAiSummary(null);
    setAiSummaryError(null);
    try {
      const entityParams = new URLSearchParams();
      if (selectedEntity) {
        entityParams.append("entities", selectedEntity);
      }
      const baseParams = new URLSearchParams();
      if (resolvedOrganizationId) {
        baseParams.set("organization_id", resolvedOrganizationId);
      }
      if (resolvedMonthKey) {
        baseParams.set("month_key", resolvedMonthKey);
      }
      const timeParams = new URLSearchParams({ granularity });
      if (startDate) {
        timeParams.set("start", startDate);
      }
      if (endDate) {
        timeParams.set("end", endDate);
      }
      for (const [key, value] of baseParams.entries()) {
        timeParams.set(key, value);
      }
      const timeQuery = timeParams.toString();
      const baseQuery = baseParams.toString();
      const entitySuffix = entityParams.toString();
      const manpowerSuffix = entitySuffix ? `${timeQuery}&${entitySuffix}` : timeQuery;
      const sharedSuffix = entitySuffix ? `${baseQuery}&${entitySuffix}` : baseQuery;
      const hasDateFilter = Boolean(startDate || endDate);
      const demographicsParams = new URLSearchParams();
      for (const [key, value] of baseParams.entries()) {
        demographicsParams.set(key, value);
      }
      if (selectedEntity) {
        demographicsParams.append("entities", selectedEntity);
      }
      if (hasDateFilter) {
        demographicsParams.set("granularity", granularity);
        if (startDate) {
          demographicsParams.set("start", startDate);
        }
        if (endDate) {
          demographicsParams.set("end", endDate);
        }
      }
      const demographicsSuffix = demographicsParams.toString();
      const [
        rampResponse,
        hiresResponse,
        demographicsResponse,
        entityDemoResponse,
        attritionResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/manpower-rampup?${manpowerSuffix}`),
        fetch(`${API_BASE_URL}/analytics/hires-exits?${manpowerSuffix}`),
        fetch(`${API_BASE_URL}/analytics/demographics?${demographicsSuffix}`),
        fetch(`${API_BASE_URL}/analytics/demographics/entities?${demographicsSuffix}`),
        fetch(`${API_BASE_URL}/analytics/attrition?${sharedSuffix}`),
      ]);
      if (
        !rampResponse.ok ||
        !hiresResponse.ok ||
        !demographicsResponse.ok ||
        !entityDemoResponse.ok ||
        !attritionResponse.ok
      ) {
        const detail = !rampResponse.ok
          ? await rampResponse.text()
          : !hiresResponse.ok
          ? await hiresResponse.text()
          : !demographicsResponse.ok
          ? await demographicsResponse.text()
          : !entityDemoResponse.ok
          ? await entityDemoResponse.text()
          : await attritionResponse.text();
        throw new Error(detail || "Analytics request failed.");
      }
      const rampPayload = await rampResponse.json();
      const hiresPayload = await hiresResponse.json();
      const demographicsPayload = await demographicsResponse.json();
      const entityPayload = await entityDemoResponse.json();
      const attritionPayload: AttritionResponse = await attritionResponse.json();
      setManpowerData(rampPayload.points ?? []);
      setHireData(hiresPayload.points ?? []);
      setDemographics(demographicsPayload ?? null);
      setEntityDemographics(entityPayload ?? null);
      setAttritionData(normalizeAttrition(attritionPayload));
    } catch (err) {
      setAnalyticsError(
        err instanceof Error ? err.message : "Unable to load analytics."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldLoadAnalytics) {
      return;
    }
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    granularity,
    startDate,
    endDate,
    isDemo,
    resolvedOrganizationId,
    resolvedMonthKey,
    shouldLoadAnalytics,
  ]);

  useEffect(() => {
    if (!resolvedOrganizationId) {
      setChartConfig(buildDefaultChartConfig());
      return;
    }
    let hasCachedConfig = false;
    const storageKey = `${DASHBOARD_CONFIG_KEY_PREFIX}${resolvedOrganizationId}`;
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Partial<ChartConfig>;
          const nextMap = buildDefaultChartConfig();
          (Object.keys(nextMap) as ChartKey[]).forEach((key) => {
            if (typeof parsed[key] === "boolean") {
              nextMap[key] = parsed[key] as boolean;
            }
          });
          setChartConfig(nextMap);
          hasCachedConfig = true;
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
    }
    const fetchConfig = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/admin/dashboard-config?organizationId=${resolvedOrganizationId}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        const nextMap = buildDefaultChartConfig();
        (payload.charts ?? []).forEach(
          (item: { key: string; enabled: boolean }) => {
            if (item.key in nextMap) {
              nextMap[item.key as ChartKey] = item.enabled;
            }
          }
        );
        setChartConfig(nextMap);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, JSON.stringify(nextMap));
        }
      } catch {
        if (!hasCachedConfig) {
          setChartConfig(buildDefaultChartConfig());
        }
      }
    };
    fetchConfig();
  }, [resolvedOrganizationId]);

  useLayoutEffect(() => {
    if (chartsReady) {
      return;
    }
    if (typeof window === "undefined") {
      setChartsReady(true);
      return;
    }
    const timeoutId = window.setTimeout(() => setChartsReady(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [chartsReady]);

  const lastManpowerDate = useMemo(
    () =>
      findLastDataDate(manpowerData, (point) =>
        hasPositiveValue(point.headcount) ||
        hasPositiveValue(point.openingHeadcount) ||
        hasNonZeroValue(point.rampChange) ||
        hasNonZeroValue(point.rampPct)
      ),
    [manpowerData]
  );

  const lastHireExitDate = useMemo(
    () =>
      findLastDataDate(hireData, (point) =>
        hasPositiveValue(point.hires) || hasPositiveValue(point.exits)
      ),
    [hireData]
  );

  const lastDataDate = useMemo(
    () => maxDate(lastManpowerDate, lastHireExitDate),
    [lastManpowerDate, lastHireExitDate]
  );

  const cappedManpowerData = useMemo(
    () => filterByMaxDate(manpowerData, lastDataDate),
    [manpowerData, lastDataDate]
  );

  const formattedManpower = useMemo(
    () =>
      cappedManpowerData.map((point) => ({
        ...point,
        label: format(parseISO(point.periodStart), granularityLabelFormat(granularity)),
      })),
    [cappedManpowerData, granularity]
  );

  const renderChartSurface = useCallback(
    (
      renderer: (height: number) => ReactNode,
      minHeight = DEFAULT_CHART_MIN_HEIGHT
    ) => {
      if (!chartsReady) {
        return (
          <div
            className="chart-placeholder"
            style={{ minHeight }}
            aria-hidden="true"
          />
        );
      }
      return renderer(minHeight);
    },
    [chartsReady]
  );

  const cappedHireData = useMemo(
    () => filterByMaxDate(hireData, lastDataDate),
    [hireData, lastDataDate]
  );

  const formattedHires = useMemo(
    () =>
      cappedHireData.map((point) => ({
        ...point,
        label: format(
          parseISO(point.periodStart),
          granularityLabelFormat(granularity)
        ),
        exitsNegative: point.exits ? -point.exits : 0,
      })),
    [cappedHireData, granularity]
  );

  const granularityOptions = [
    { label: "Monthly", value: "monthly" },
    { label: "Quarterly", value: "quarterly" },
    { label: "Yearly", value: "yearly" },
  ];
  const entityOptions = [
    { label: "All entities", value: "" },
    ...entities.map((entity) => ({ label: entity, value: entity })),
  ];


  useEffect(() => {
    // refetch analytics when entity filter changes
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntity]);

  const handleGenerateSummary = async () => {
    if (isDemo) {
      setAiSummary(DEMO_AI_SUMMARY);
      setAiSummaryError(null);
      return;
    }
    const payload = buildAiSummaryPayload();
    if (!payload.charts.length) {
      setAiSummaryError("No chart data available to summarize yet.");
      return;
    }
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/ai/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "AI summary request failed.");
      }
      const summary = (await response.json()) as AiSummaryResponse;
      setAiSummary(summary);
    } catch (err) {
      setAiSummaryError(
        err instanceof Error ? err.message : "Unable to generate AI summary."
      );
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const latestManpowerPoint = cappedManpowerData.at(-1);
  const previousManpowerPoint =
    cappedManpowerData.length > 1 ? cappedManpowerData.at(-2) : undefined;
  const fallbackOpeningHeadcount = previousManpowerPoint?.headcount ?? 0;
  const latestHeadcount = latestManpowerPoint?.headcount ?? 0;
  const latestOpeningHeadcount =
    latestManpowerPoint?.openingHeadcount ?? fallbackOpeningHeadcount;
  const headcountNetChange =
    latestManpowerPoint?.rampChange ??
    (latestManpowerPoint
      ? latestHeadcount - latestOpeningHeadcount
      : 0);
  const totalHires = cappedHireData.reduce(
    (sum, point) => sum + (point.hires ?? 0),
    0
  );
  const totalExits = cappedHireData.reduce(
    (sum, point) => sum + (point.exits ?? 0),
    0
  );
  const aggregateNetChange = totalHires - totalExits;
  const resolvedHeadcountNetChange =
    headcountNetChange !== 0 ? headcountNetChange : aggregateNetChange;
  const headcountNetPct =
    headcountNetChange !== 0 && latestOpeningHeadcount
      ? headcountNetChange / latestOpeningHeadcount
      : latestOpeningHeadcount
      ? aggregateNetChange / latestOpeningHeadcount
      : 0;
  const headcountNetPctDisplay = formatPercentValue(headcountNetPct, 1);
  const manpowerBarSize = computeBarSize(formattedManpower.length);
  const hireBarSize = computeBarSize(formattedHires.length);
  const manpowerTickInterval = computeTickInterval(formattedManpower.length);
  const hireTickInterval = computeTickInterval(formattedHires.length);
  const totalHiresDisplay = totalHires;
  const totalExitsDisplay = totalExits;
  const {
    worklevelStats,
    worklevelTableRows,
    maxWorklevelHeadcount,
  } = useMemo(() => {
    if (!demographics?.worklevels?.length) {
      return {
        worklevelStats: [],
        worklevelTableRows: [],
        maxWorklevelHeadcount: 1,
      };
    }
    const tierOrder = ["Top", "Senior", "Mid", "Junior"];
    const sorted = [...demographics.worklevels].sort((a, b) => {
      const aTotal =
        a.isTotal || (a.worklevel ?? "").trim().toLowerCase() === "total";
      const bTotal =
        b.isTotal || (b.worklevel ?? "").trim().toLowerCase() === "total";
      if (aTotal && !bTotal) return 1;
      if (bTotal && !aTotal) return -1;
      const aIndex = tierOrder.indexOf((a.worklevel || "").trim());
      const bIndex = tierOrder.indexOf((b.worklevel || "").trim());
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return (b.headcount ?? 0) - (a.headcount ?? 0);
    });
    const seen = new Map<string, WorkLevelStats>();
    for (const stat of sorted) {
      const name = (stat.worklevel || "Unspecified").trim();
      const isTotal =
        stat.isTotal || name.toLowerCase() === "total" ? true : false;
      const existing = seen.get(name);
      if (existing) {
        existing.headcount = (existing.headcount ?? 0) + (stat.headcount ?? 0);
        existing.headcountPct += stat.headcountPct;
        existing.costPct += stat.costPct;
        existing.femalePct += stat.femalePct;
        existing.avgTenure = averageCombine(existing.avgTenure, stat.avgTenure);
        existing.avgAge = averageCombine(existing.avgAge, stat.avgAge);
        existing.isTotal = existing.isTotal || isTotal;
      } else {
        seen.set(name, { ...stat, worklevel: name, isTotal });
      }
    }
    const combined = Array.from(seen.values()).sort((a, b) => {
      const aTotal = a.isTotal;
      const bTotal = b.isTotal;
      if (aTotal && !bTotal) return 1;
      if (bTotal && !aTotal) return -1;
      const tierOrder = ["Top", "Senior", "Mid", "Junior"];
      const aIndex = tierOrder.indexOf((a.worklevel || "").trim());
      const bIndex = tierOrder.indexOf((b.worklevel || "").trim());
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return (b.headcount ?? 0) - (a.headcount ?? 0);
    });
    const nonTotalRows = combined.filter((row) => !row.isTotal);
    const maxHeadcount = Math.max(
      ...nonTotalRows.map((row) => row.headcount ?? 0),
      0
    );
    return {
      worklevelStats: nonTotalRows,
      worklevelTableRows: combined,
      maxWorklevelHeadcount: maxHeadcount || 1,
    };
  }, [demographics]);

  const averageCtcDisplay = formatCurrencyValue(demographics?.averages?.ctc);
  const averageAgeDisplay = formatNumberValue(
    demographics?.averages?.age,
    1,
    " yrs"
  );
  const averageTenureDisplay = formatNumberValue(
    demographics?.averages?.tenure,
    1,
    " yrs"
  );
  const femaleRatio = formatPercentValue(demographics?.genderRatio?.female);
  const entityStats = useMemo(() => {
    if (!entityDemographics?.entities?.length) {
      return [];
    }
    return entityDemographics.entities
      .map((stat) => ({
        ...stat,
        label: (stat.entity || "Unspecified").trim(),
      }))
      .sort((a, b) => (b.headcount ?? 0) - (a.headcount ?? 0));
  }, [entityDemographics]);
  const entityChartHeight = useMemo(() => {
    const count = entityStats.length || 1;
    return Math.max(280, count * 85);
  }, [entityStats.length]);
  const ageTrend = attritionData?.ageTrend ?? [];
  const genderTrend = attritionData?.genderTrend ?? [];
  const tenureTrend = attritionData?.tenureTrend ?? [];
  const ageGroupSeries = [
    { key: "twentyPct", label: "20+", color: "#38bdf8" },
    { key: "thirtyPct", label: "30+", color: "#f97316" },
    { key: "fortyPct", label: "40+", color: "#fbbf24" },
    { key: "fiftyPct", label: "50+", color: "#94a3b8" },
  ] as const;
  const genderSeries = [
    { key: "malePct", label: "Male", color: "#2563eb" },
    { key: "femalePct", label: "Female", color: "#ec4899" },
  ] as const;
  const tenureSeries = [
    { key: "zeroSixPct", label: "0-6 months" },
    { key: "sixTwelvePct", label: "6-12 months" },
    { key: "oneTwoPct", label: "1-2 years" },
    { key: "twoFourPct", label: "2-4 years" },
    { key: "fourTenPct", label: "4-10 years" },
    { key: "tenPlusPct", label: "10+ years" },
  ] as const;
  const tenureChartData = useMemo(
    () =>
      tenureSeries.map((series) => {
        const values = Object.fromEntries(
          tenureTrend.map((point) => [
            point.label,
            point[series.key as keyof TenureTrendPoint] as number,
          ])
        ) as Record<string, number>;
        return {
          bucket: series.label,
          ...values,
        };
      }),
    [tenureTrend]
  );
  const overallAttrition = attritionData?.overall ?? [];
  const entityAttrition = useMemo(() => {
    if (!attritionData?.entities?.length) {
      return {
        rows: [] as Array<Record<string, string | number>>,
        series: [] as Array<{ key: string; name: string; color: string }>,
      };
    }
    const rowMap = new Map<string, Record<string, string | number>>();
    const seriesMap = new Map<
      string,
      { name: string; hasValue: boolean }
    >();
    attritionData.entities.forEach((point) => {
      const name = point.entity || "Unspecified";
      const key = slugify(name);
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { name, hasValue: false });
      }
      const row = rowMap.get(point.label) ?? { label: point.label };
      if (point.attritionPct && point.attritionPct !== 0) {
        row[key] = point.attritionPct;
        const entry = seriesMap.get(key);
        if (entry) {
          entry.hasValue = true;
        }
      }
      rowMap.set(point.label, row);
    });
    const colors = ["#0ea5e9", "#f16f11ff", "#fcd34d", "#94a3b8", "#22c55e"];
    const series = Array.from(seriesMap.entries())
      .filter(([, meta]) => meta.hasValue)
      .map(([key, meta], index) => ({
        key,
        name: meta.name,
        color: colors[index % colors.length],
      }));
    const filteredRows = Array.from(rowMap.values()).map((row) => {
      const filtered = { ...row };
      series.forEach((s) => {
        if (!(s.key in row)) {
          delete filtered[s.key];
        }
      });
      return filtered;
    });
    return { rows: filteredRows, series };
  }, [attritionData]);

  const truncateSeries = <T,>(series: T[], maxPoints = 24) =>
    series.length > maxPoints ? series.slice(-maxPoints) : series;

  const buildAiSummaryPayload = () => {
    const charts: Array<{
      id: string;
      title: string;
      data: unknown;
      context?: Record<string, unknown>;
    }> = [];

    if (effectiveChartConfig.manpower_rampup) {
      charts.push({
        id: "manpower_rampup",
        title: "Manpower ramp-up",
        data: truncateSeries(formattedManpower).map((point) => ({
          label: point.label,
          headcount: point.headcount,
          openingHeadcount: point.openingHeadcount,
          rampChange: point.rampChange,
          rampPct: point.rampPct,
        })),
      });
    }

    if (effectiveChartConfig.hires_exits) {
      charts.push({
        id: "hires_exits",
        title: "Hires vs exits",
        data: truncateSeries(formattedHires).map((point) => ({
          label: point.label,
          hires: point.hires,
          exits: point.exits,
        })),
      });
    }

    if (effectiveChartConfig.worklevel_overview) {
      charts.push({
        id: "worklevel_overview",
        title: "Work level overview",
        data: {
          worklevels: worklevelTableRows.map((row) => ({
            worklevel: row.worklevel,
            headcount: row.headcount,
            headcountPct: row.headcountPct,
            costPct: row.costPct,
            femalePct: row.femalePct,
            avgTenure: row.avgTenure,
            avgAge: row.avgAge,
            isTotal: row.isTotal,
          })),
          averages: demographics?.averages ?? null,
          genderRatio: demographics?.genderRatio ?? null,
        },
      });
    }

    if (effectiveChartConfig.entity_overview) {
      charts.push({
        id: "entity_overview",
        title: "Entity overview",
        data: truncateSeries(entityStats, 16).map((stat) => ({
          entity: stat.label,
          headcount: stat.headcount,
          headcountPct: stat.headcountPct,
          costPct: stat.costPct,
          femalePct: stat.femalePct,
          avgTenure: stat.avgTenure,
          avgAge: stat.avgAge,
        })),
      });
    }

    if (effectiveChartConfig.overall_attrition) {
      charts.push({
        id: "overall_attrition",
        title: "Overall attrition",
        data: truncateSeries(overallAttrition).map((point) => ({
          label: point.label,
          attritionPct: point.attritionPct,
        })),
      });
    }

    if (effectiveChartConfig.entity_attrition) {
      charts.push({
        id: "entity_attrition",
        title: "Entity attrition",
        data: {
          series: entityAttrition.series.map((series) => ({
            key: series.key,
            name: series.name,
          })),
          points: truncateSeries(entityAttrition.rows),
        },
      });
    }

    if (effectiveChartConfig.age_attrition) {
      charts.push({
        id: "age_attrition",
        title: "Age attrition",
        data: truncateSeries(ageTrend).map((point) => ({
          label: point.label,
          twentyPct: point.twentyPct,
          thirtyPct: point.thirtyPct,
          fortyPct: point.fortyPct,
          fiftyPct: point.fiftyPct,
        })),
      });
    }

    if (effectiveChartConfig.gender_attrition) {
      charts.push({
        id: "gender_attrition",
        title: "Gender attrition",
        data: truncateSeries(genderTrend).map((point) => ({
          label: point.label,
          malePct: point.malePct,
          femalePct: point.femalePct,
        })),
      });
    }

    if (effectiveChartConfig.tenure_attrition) {
      charts.push({
        id: "tenure_attrition",
        title: "Tenure attrition",
        data: truncateSeries(tenureTrend).map((point) => ({
          label: point.label,
          zeroSixPct: point.zeroSixPct,
          sixTwelvePct: point.sixTwelvePct,
          oneTwoPct: point.oneTwoPct,
          twoFourPct: point.twoFourPct,
          fourTenPct: point.fourTenPct,
          tenPlusPct: point.tenPlusPct,
        })),
      });
    }

    return {
      dashboardTitle: "Company Analytics",
      organization: dashboardSelection?.orgLabel ?? "Organization",
      period: {
        granularity,
        startDate: startDate || null,
        endDate: endDate || null,
        monthKey: resolvedMonthKey,
        entity: selectedEntity || null,
      },
      charts,
    };
  };

  const chartSummaryText = useCallback(
    (chartId: string) => aiSummary?.chartSummaries[chartId] ?? null,
    [aiSummary]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (aiSummaryLoading) {
      if (bodyOverflowRef.current === null) {
        bodyOverflowRef.current = document.body.style.overflow;
      }
      document.body.style.overflow = "hidden";
    } else if (bodyOverflowRef.current !== null) {
      document.body.style.overflow = bodyOverflowRef.current;
      bodyOverflowRef.current = null;
    }
    return () => {
      if (bodyOverflowRef.current !== null) {
        document.body.style.overflow = bodyOverflowRef.current;
        bodyOverflowRef.current = null;
      }
    };
  }, [aiSummaryLoading]);

  if (view === "org-admin") {
    return (
      <div className="admin-root">
        <OrgAdminPanel
          organizationId={currentUser?.organizationId ?? null}
          createdBy={currentUser?.name || currentUser?.email || "Admin"}
          userName={currentUser?.name || currentUser?.email}
          onExit={() => navigate("dashboard")}
          onSignOut={handleSignOut}
        />
      </div>
    );
  }

  if (view === "admin") {
    return (
      <div className="admin-root">
        <AdminPage
          onExit={() => navigate("dashboard")}
          onOpenDashboard={handleOpenDashboard}
          userName={currentUser?.name || currentUser?.email}
          onSignOut={handleSignOut}
        />
      </div>
    );
  }

  if (view === "landing") {
    return (
      <LandingPage
        onPrimaryAction={() =>
          window.open(
            `${window.location.origin}?view=login`,
            "_blank",
            "noopener"
          )
        }
        onContactAction={() => navigate("contact")}
        onDemoAction={() => navigate("demo")}
      />
    );
  }

  if (view === "contact") {
    return <ContactPage />;
  }

  if (view === "login") {
    return (
      <LoginPage
        onLogin={(result) => {
          setCurrentUser(result);
          navigate(result.role === "ADMIN" ? "admin" : "org-admin");
        }}
        onForgotPassword={() => navigate("forgot")}
      />
    );
  }

  if (view === "forgot") {
    return <ForgotPasswordPage onBack={() => navigate("login")} />;
  }

  if (view === "reset") {
    const token =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("token")
        : null;
    return <ResetPasswordPage token={token} onBack={() => navigate("login")} />;
  }

  const aiSummaryButtonLabel = aiSummaryLoading
    ? "Summarizing…"
    : aiSummary
      ? "Update AI Summary"
      : "Generate AI Summary";

  return (
    <div className={`app-shell app-shell--dashboard${isDemo ? " app-shell--demo" : ""}`}>
      {aiSummaryLoading && (
        <div className="ai-summary__page-overlay" role="status" aria-live="polite">
          <div className="ai-summary__page-content">
            <div className="ai-summary__loader">
              <div className="ai-summary__orb" aria-hidden="true" />
              <div className="ai-summary__ring" aria-hidden="true" />
              <div className="ai-summary__spark" aria-hidden="true" />
            </div>
            <p>Summarizing your dashboard with AI…</p>
          </div>
        </div>
      )}
      <header className="dashboard-hero">
        <div className="dashboard-hero__eyebrow">HR Intelligence Hub</div>
        <div className="dashboard-hero__row">
          <h1>Company Analytics</h1>
          <div className="dashboard-actions">
            <button
              type="button"
              className="dashboard-action"
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
            >
              {analyticsLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="dashboard-action dashboard-action--primary"
              onClick={handleGenerateSummary}
              disabled={analyticsLoading || aiSummaryLoading || isDemo}
            >
              {aiSummaryButtonLabel}
            </button>
          </div>
        </div>
        <p>
          Track workforce momentum, attrition signals, and demographic balance
          across the latest monthly snapshot.
        </p>
      </header>

      {entityError && <p className="error-text">⚠️ {entityError}</p>}
      {analyticsError && <p className="error-text">⚠️ {analyticsError}</p>}
      {aiSummaryError && <p className="error-text">⚠️ {aiSummaryError}</p>}

      <section className="filters-panel">
        <div className="filters">
          <label>
            Granularity
            <Select
              options={granularityOptions}
              value={granularity}
              onChange={(value) => setGranularity(value as Granularity)}
            />
          </label>
          <div className="filter-field">
            <span>Start date</span>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="yyyy / mm / dd"
            />
          </div>
          <div className="filter-field">
            <span>End date</span>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="yyyy / mm / dd"
              min={startDate || undefined}
            />
          </div>
          <label className="entity-select">
            Entity
            <Select
              options={entityOptions}
              value={selectedEntity}
              placeholder={entityLoading ? "Loading..." : "Select an entity"}
              onChange={(value) => setSelectedEntity(value)}
            />
          </label>
        </div>
      </section>

      {analyticsLoading && (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <div className="dashboard-loading__card">
            <div className="dashboard-loading__spinner" aria-hidden="true" />
            <div>
              <p className="dashboard-loading__title">Turning data into decisions…</p>
              <p className="dashboard-loading__subtitle">
                Refreshing your workforce insights.
              </p>
            </div>
          </div>
        </div>
      )}

      {!analyticsLoading && (
        <section className="card analytics-card" ref={dashboardRef}>

        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Headcount</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
            </div>
            <h3>{latestHeadcount}</h3>
            <span>
              Active employees in the latest period
              
            </span>
          </div>
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Total hires</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </span>
            </div>
            <h3>{totalHiresDisplay}</h3>
            <span>Across the selected range</span>
          </div>
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Total exits</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              </span>
            </div>
            <h3>{totalExitsDisplay}</h3>
            <span>Across the selected range</span>
          </div>
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Net change</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </span>
            </div>
            <h3 className={resolvedHeadcountNetChange >= 0 ? "positive" : "negative"}>
              {resolvedHeadcountNetChange >= 0
                ? `+${resolvedHeadcountNetChange}`
                : resolvedHeadcountNetChange}
            </h3>
            <span>
              Vs previous period{" "}
              {headcountNetPctDisplay !== "—" && `(${headcountNetPctDisplay})`}
            </span>
          </div>
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Average CTC</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
                  <circle cx="8" cy="12" r="2" />
                </svg>
              </span>
            </div>
            <h3>{averageCtcDisplay}</h3>
            <span>Across active workforce</span>
          </div>
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Average age</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </span>
            </div>
            <h3>{averageAgeDisplay}</h3>
            <span>Years</span>
          </div>
          <div className="summary-card">
            <div className="summary-card-header">
              <p>Average tenure</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M9 7V5a3 3 0 0 1 6 0v2" />
                  <path d="M3 13h18" />
                </svg>
              </span>
            </div>
            <h3>{averageTenureDisplay}</h3>
            <span>Years with the organisation</span>
          </div>
          <div className="summary-card gender-card">
            <div className="summary-card-header">
              <p>Gender Demographics</p>
              <span className="summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <path d="M12 3v9h9" />
                </svg>
              </span>
            </div>
            <h3>{femaleRatio}</h3>
            <span>Female</span>
          </div>
        </div>

        {aiSummary && (
          <section className="ai-summary ai-summary--shell">
            <div className="ai-summary__card ai-summary__card--overview">
              <div className="ai-summary__header">
                <h3>AI Summary</h3>
                <p>Highlights generated from the current dashboard view.</p>
              </div>
              <div className="ai-summary__section">
                <h4>Dashboard overview</h4>
                <p className="ai-summary__text">{aiSummary.dashboardSummary}</p>
              </div>
            </div>
          </section>
        )}

        {(effectiveChartConfig.manpower_rampup ||
          effectiveChartConfig.hires_exits) && (
          <div className="charts-grid">
            {effectiveChartConfig.manpower_rampup && (
              <div className="chart-card" ref={manpowerCopyRef}>
            <CopyChartButton targetRef={manpowerCopyRef} label="Manpower Ramp-up" />
            <h3>MANPOWER RAMP-UP</h3>
            <div className="chart-wrapper">
              {renderChartSurface(
                (height) => (
                  <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                      data={formattedManpower}
                      margin={{ top: 24, right: 8, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#d4dbe9"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5f5" }}
                        tickMargin={12}
                        interval={manpowerTickInterval}
                        tick={{ fill: "#475569", fontWeight: 600 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5f5" }}
                        tick={{ fill: "#475569", fontWeight: 600 }}
                      />
                      <Tooltip
                        contentStyle={tooltipContentStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={tooltipItemStyle}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ paddingTop: 4 }}
                        formatter={(value: string) => (
                          <span style={{ color: "#0f172a", fontWeight: 600 }}>
                            {value}
                          </span>
                        )}
                      />
                      <Bar
                        dataKey="headcount"
                        fill="#16a34a"
                        name="Headcount"
                        maxBarSize={48}
                        barSize={manpowerBarSize}
                        activeBar={{ fill: "#22c55e", stroke: "#15803d" }}
                        radius={[10, 10, 0, 0]}
                      >
                        <LabelList
                          dataKey="headcount"
                          position="top"
                          offset={8}
                          fill="#0f172a"
                          fontWeight={600}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ),
                DEFAULT_CHART_MIN_HEIGHT
              )}
            </div>
            {chartSummaryText("manpower_rampup") && (
              <AiSummaryInsight text={chartSummaryText("manpower_rampup") as string} />
            )}
          </div>
            )}
            {effectiveChartConfig.hires_exits && (
              <div className="chart-card" ref={hiresCopyRef}>
            <CopyChartButton targetRef={hiresCopyRef} label="Hires vs Exits" />
            <h3>HIRES VS EXITS</h3>
            <div className="chart-wrapper">
              {renderChartSurface(
                (height) => (
                  <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                      data={formattedHires}
                      margin={{ top: 24, right: 8, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#d4dbe9"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5f5" }}
                        tickMargin={12}
                        interval={hireTickInterval}
                        tick={{ fill: "#475569", fontWeight: 600 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5f5" }}
                        tick={{ fill: "#475569", fontWeight: 600 }}
                      />
                      <Tooltip
                        formatter={(value: number, name) => [
                          Math.abs(Number(value)),
                          name,
                        ]}
                        contentStyle={tooltipContentStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={tooltipItemStyle}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ paddingTop: 4 }}
                        formatter={(value: string) => (
                          <span style={{ color: "#0f172a", fontWeight: 600 }}>
                            {value}
                          </span>
                        )}
                      />
                      <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} />
                      <Bar
                        dataKey="hires"
                        fill="#16a34a"
                        name="Hires"
                        maxBarSize={48}
                        barSize={hireBarSize}
                        radius={[10, 10, 0, 0]}
                      >
                        <LabelList
                          dataKey="hires"
                          position="top"
                          fill="#14532d"
                          fontWeight={600}
                        />
                      </Bar>
                      <Bar
                        dataKey="exitsNegative"
                        fill="#dc2626"
                        name="Exits"
                        maxBarSize={48}
                        barSize={hireBarSize}
                        radius={[10, 10, 0, 0]}
                      >
                        <LabelList
                          dataKey="exitsNegative"
                          position="bottom"
                          fill="#7f1d1d"
                          fontWeight={600}
                          formatter={absoluteValueLabel}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ),
                DEFAULT_CHART_MIN_HEIGHT
              )}
            </div>
            {chartSummaryText("hires_exits") && (
              <AiSummaryInsight text={chartSummaryText("hires_exits") as string} />
            )}
          </div>
            )}
          </div>
        )}
        {effectiveChartConfig.worklevel_overview && (
          <div className="chart-card worklevel-card" ref={worklevelCopyRef}>
          <CopyChartButton
            targetRef={worklevelCopyRef}
            label="Work level wise HC & Demographics Overview"
          />
          <h3>WORK LEVEL WISE HC & DEMOGRAPHICS OVERVIEW</h3>
          <div className="worklevel-content">
            <div className="worklevel-chart-panel">
              {worklevelStats.length === 0 ? (
                <p className="empty-text">No work level data yet.</p>
              ) : (
                <div className="pyramid-chart padded">
                  {worklevelStats.map((stat) => {
                    const headcount = stat.headcount ?? 0;
                    const widthPercent = Math.max(
                      15,
                      Math.min(
                        (headcount / maxWorklevelHeadcount) * 100,
                        100
                      )
                    );
                    return (
                      <div className="pyramid-row" key={stat.worklevel}>
                        <span className="pyramid-label">
                          {stat.worklevel}
                        </span>
                        <div className="pyramid-bar-wrapper">
                          <div
                            className="pyramid-bar"
                            style={{ width: `${widthPercent}%` }}
                          >
                            {formatNumberValue(headcount)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="worklevel-table">
              <div className="worklevel-table-header">
                <span>Work level</span>
                <span>% HC</span>
                <span>% Cost</span>
                <span>% Female</span>
                <span>Avg. tenure</span>
                <span>Avg. age</span>
              </div>
              {worklevelTableRows.length === 0 ? (
                <p className="empty-text">No demographic breakdown found.</p>
              ) : (
                worklevelTableRows.map((stat) => (
                  <div
                    className={`worklevel-table-row${stat.isTotal ? " total-row" : ""}`}
                    key={stat.worklevel}
                  >
                    <span className="worklevel-name">
                      {stat.worklevel}
                    </span>
                    {stat.isTotal ? (
                      <span />
                    ) : (
                      <span className="metric-pill">
                        {formatPercentValue(stat.headcountPct)}
                      </span>
                    )}
                    {stat.isTotal ? (
                      <span />
                    ) : (
                      <span className="metric-pill">
                        {formatPercentValue(stat.costPct)}
                      </span>
                    )}
                    <span className="metric-pill">
                      {formatPercentValue(stat.femalePct)}
                    </span>
                    <span className="metric-pill">
                      {formatNumberValue(stat.avgTenure, 1, " yrs")}
                    </span>
                    <span className="metric-pill">
                      {formatNumberValue(stat.avgAge, 1, " yrs")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}
        {effectiveChartConfig.entity_overview && (
          <div className="chart-card entity-card" ref={entityHcCopyRef}>
          <CopyChartButton
            targetRef={entityHcCopyRef}
            label="Entity wise HC & Demographics Overview"
          />
          <h3>ENTITY WISE HC & DEMOGRAPHICS OVERVIEW</h3>
          <div className="worklevel-content">
            <div className="entity-chart-panel">
              {entityStats.length === 0 ? (
                <p className="empty-text">No entity breakdown yet.</p>
              ) : (
                renderChartSurface(
                  (height) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <BarChart
                        data={entityStats}
                        layout="vertical"
                        margin={{
                          top: 28,
                          right: 32,
                          left: 24,
                          bottom: 10,
                        }}
                        barCategoryGap="0%"
                        barGap={0}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#fed7aa"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fill: "#92400e", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: "#fed7aa" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          axisLine={{ stroke: "#fed7aa" }}
                          tickLine={false}
                          tick={{ fill: "#78350f", fontWeight: 700 }}
                          width={140}
                        />
                        <defs>
                          <linearGradient
                            id="entityGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                          >
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#fb923c" />
                          </linearGradient>
                        </defs>
                        <Bar
                          dataKey="headcount"
                          fill="url(#entityGradient)"
                          radius={[0, 24, 24, 0]}
                          barSize={42}
                        >
                          <LabelList
                            dataKey="headcount"
                            position="right"
                            fill="#78350f"
                            fontWeight={700}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ),
                  entityChartHeight
                )
              )}
            </div>
            <div className="entity-table">
              <div className="entity-table-header">
                <span>Entity</span>
                <span>% HC</span>
                <span>% Cost</span>
                <span>% Female</span>
                <span>Avg. tenure</span>
                <span>Avg. age</span>
              </div>
              {entityStats.length === 0 ? (
                <p className="empty-text">No entity breakdown found.</p>
              ) : (
                entityStats.map((stat) => (
                  <div className="entity-table-row" key={stat.label}>
                    <span className="entity-name">{stat.label}</span>
                    <span className="entity-pill">
                      {formatPercentValue(stat.headcountPct)}
                    </span>
                    <span className="entity-pill">
                      {formatPercentValue(stat.costPct)}
                    </span>
                    <span className="entity-pill">
                      {formatPercentValue(stat.femalePct)}
                    </span>
                    <span className="entity-pill">
                      {formatNumberValue(stat.avgTenure, 1, " yrs")}
                    </span>
                    <span className="entity-pill">
                      {formatNumberValue(stat.avgAge, 1, " yrs")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}
        {(effectiveChartConfig.overall_attrition ||
          effectiveChartConfig.entity_attrition) && (
          <div className="charts-grid two-column">
            {effectiveChartConfig.overall_attrition && (
              <div className="chart-card" ref={overallAttritionCopyRef}>
            <CopyChartButton
              targetRef={overallAttritionCopyRef}
              label="Overall 4 year period attrition"
            />
            <h3>OVERALL 4 YEAR PERIOD ATTRITION</h3>
            <div className="chart-wrapper">
              {overallAttrition.length === 0 ? (
                <p className="empty-text">No attrition data yet.</p>
              ) : (
                renderChartSurface(
                  (height) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <LineChart
                        data={overallAttrition}
                        margin={{ top: 24, right: 8, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                          tickFormatter={percentTickFormatter}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            percentTickFormatter(Number(value)),
                            "Attrition",
                          ]}
                          contentStyle={tooltipContentStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                        />
                        <Line
                          type="monotone"
                          dataKey="attritionPct"
                          stroke="#a16207"
                          strokeWidth={3}
                          dot={{
                            stroke: "#78350f",
                            strokeWidth: 2,
                            r: 6,
                          }}
                          activeDot={{ r: 8, fill: "#f97316" }}
                        >
                          <LabelList
                            dataKey="attritionPct"
                            formatter={percentLabelFormatter}
                            position="top"
                            dy={-8}
                            fill="#78350f"
                            className="chart-label-small"
                          />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  ),
                  DEFAULT_CHART_MIN_HEIGHT
                )
              )}
            </div>
            {chartSummaryText("overall_attrition") && (
              <AiSummaryInsight text={chartSummaryText("overall_attrition") as string} />
            )}
          </div>
            )}
            {effectiveChartConfig.entity_attrition && (
              <div className="chart-card" ref={entityAttritionCopyRef}>
            <CopyChartButton
              targetRef={entityAttritionCopyRef}
              label="Entity wise 4 year period attrition"
            />
            <h3>ENTITY WISE 4 YEAR PERIOD ATTRITION</h3>
            <div className="chart-wrapper">
              {entityAttrition.rows.length === 0 ? (
                <p className="empty-text">No entity attrition data yet.</p>
              ) : (
                renderChartSurface(
                  (height) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <BarChart
                        data={entityAttrition.rows as any[]}
                        margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                        barCategoryGap="0%"
                        barGap={0}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                          tickFormatter={percentTickFormatter}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            percentTickFormatter(Number(value)),
                            "Attrition",
                          ]}
                          contentStyle={tooltipContentStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: 4 }}
                          formatter={(value: string) => (
                            <span style={{ color: "#0f172a", fontWeight: 600 }}>
                              {value}
                            </span>
                          )}
                        />
                        {entityAttrition.series.map((series) => (
                          <Bar
                            key={series.key}
                            dataKey={series.key}
                            name={series.name}
                            fill={series.color}
                            barSize={24}
                            radius={[6, 6, 0, 0]}
                          >
                            <LabelList
                              position="top"
                              formatter={percentLabelFormatter}
                              className="chart-label-small"
                            />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ),
                  COMPACT_CHART_MIN_HEIGHT
                )
              )}
            </div>
            {chartSummaryText("entity_attrition") && (
              <AiSummaryInsight text={chartSummaryText("entity_attrition") as string} />
            )}
          </div>
            )}
          </div>
        )}
        {(effectiveChartConfig.age_attrition ||
          effectiveChartConfig.gender_attrition) && (
          <div className="charts-grid two-column">
            {effectiveChartConfig.age_attrition && (
              <div className="chart-card" ref={ageCopyRef}>
            <CopyChartButton
              targetRef={ageCopyRef}
              label="Age group wise 4 year period"
            />
            <h3>AGE GROUP WISE 4 YEAR PERIOD ATTRITION</h3>
            <div className="chart-wrapper">
              {ageTrend.length === 0 ? (
                <p className="empty-text">No age trend data yet.</p>
              ) : (
                renderChartSurface(
                  (height) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <BarChart
                        data={ageTrend}
                        margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                        barCategoryGap="15%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                          tickFormatter={percentTickFormatter}
                        />
                        <Tooltip
                          formatter={(value: number, name) => [
                            percentTickFormatter(Number(value)),
                            name,
                          ]}
                          contentStyle={tooltipContentStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: 4 }}
                          formatter={(value: string) => (
                            <span style={{ color: "#0f172a", fontWeight: 600 }}>
                              {value}
                            </span>
                          )}
                        />
                        {ageGroupSeries.map((series) => (
                          <Bar
                            key={series.key}
                            dataKey={series.key}
                            name={series.label}
                            fill={series.color}
                            barSize={20}
                            radius={[4, 4, 0, 0]}
                          >
                            <LabelList
                              position="top"
                              formatter={percentLabelFormatter}
                              className="chart-label-small"
                            />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ),
                  COMPACT_CHART_MIN_HEIGHT
                )
              )}
            </div>
            {chartSummaryText("age_attrition") && (
              <AiSummaryInsight text={chartSummaryText("age_attrition") as string} />
            )}
          </div>
            )}
            {effectiveChartConfig.gender_attrition && (
              <div className="chart-card" ref={genderCopyRef}>
            <CopyChartButton
              targetRef={genderCopyRef}
              label="Gender wise 4 year period"
            />
            <h3>GENDER WISE 4 YEAR PERIOD ATTRITION</h3>
            <div className="chart-wrapper">
              {genderTrend.length === 0 ? (
                <p className="empty-text">No gender trend data yet.</p>
              ) : (
                renderChartSurface(
                  (height) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <BarChart
                        data={genderTrend}
                        margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                        barCategoryGap="25%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={{ stroke: "#cbd5f5" }}
                          tick={{ fill: "#0f172a", fontWeight: 600 }}
                          tickFormatter={percentTickFormatter}
                        />
                        <Tooltip
                          formatter={(value: number, name) => [
                            percentTickFormatter(Number(value)),
                            name,
                          ]}
                          contentStyle={tooltipContentStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ paddingTop: 4 }}
                          formatter={(value: string) => (
                            <span style={{ color: "#0f172a", fontWeight: 600 }}>
                              {value}
                            </span>
                          )}
                        />
                        {genderSeries.map((series) => (
                          <Bar
                            key={series.key}
                            dataKey={series.key}
                            name={series.label}
                            fill={series.color}
                            barSize={28}
                            radius={[6, 6, 0, 0]}
                          >
                            <LabelList
                              position="top"
                              formatter={percentLabelFormatter}
                              className="chart-label-small"
                            />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ),
                  COMPACT_CHART_MIN_HEIGHT
                )
              )}
            </div>
            {chartSummaryText("gender_attrition") && (
              <AiSummaryInsight text={chartSummaryText("gender_attrition") as string} />
            )}
          </div>
            )}
          </div>
        )}
        {effectiveChartConfig.tenure_attrition && (
          <div className="chart-card" ref={tenureCopyRef}>
          <CopyChartButton
            targetRef={tenureCopyRef}
            label="Tenure wise 4 year period"
          />
          <h3>TENURE WISE 4 YEAR PERIOD ATTRITION</h3>
          <div className="chart-wrapper">
            {tenureTrend.length === 0 ? (
              <p className="empty-text">No tenure trend data yet.</p>
            ) : (
              renderChartSurface(
                (height) => (
                  <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                      data={tenureChartData}
                      margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                      barCategoryGap="10%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="bucket"
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5f5" }}
                        tick={{ fill: "#0f172a", fontWeight: 600 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: "#cbd5f5" }}
                        tickFormatter={percentTickFormatter}
                        tick={{ fill: "#0f172a", fontWeight: 600 }}
                      />
                      <Tooltip
                        formatter={(value: number, name) => [
                          percentTickFormatter(Number(value)),
                          name,
                        ]}
                        contentStyle={tooltipContentStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={tooltipItemStyle}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ paddingTop: 4 }}
                        formatter={(value: string) => (
                          <span style={{ color: "#0f172a", fontWeight: 600 }}>
                            {value}
                          </span>
                        )}
                      />
                      {tenureTrend.map((point) => (
                        <Bar
                          key={point.label}
                          dataKey={point.label}
                          name={point.label}
                          fill={
                            {
                              FY23: "#2563eb",
                              FY24: "#f97316",
                              FY25: "#9ca3af",
                              "YTD FY26": "#facc15",
                            }[point.label] || "#38bdf8"
                          }
                          barSize={18}
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList
                            position="top"
                            formatter={percentLabelFormatter}
                            className="chart-label-small"
                          />
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ),
                COMPACT_CHART_MIN_HEIGHT
              )
            )}
            </div>
            {chartSummaryText("tenure_attrition") && (
              <AiSummaryInsight text={chartSummaryText("tenure_attrition") as string} />
            )}
          </div>
        )}
        </section>
      )}

      <div className="dashboard-footer">
        Powered by ZaroHR Insights
      </div>
    </div>
  );
}

function granularityLabelFormat(granularity: Granularity) {
  switch (granularity) {
    case "monthly":
      return "MMM yyyy";
    case "quarterly":
      return "'Q'q yyyy";
    case "yearly":
    default:
      return "yyyy";
  }
}

function hasPositiveValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasNonZeroValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}

function findLastDataDate<T>(points: T[], hasValue: (point: T) => boolean) {
  let lastDate: Date | null = null;
  points.forEach((point, index) => {
    if (!hasValue(point)) {
      return;
    }
    const period = points[index] as { periodStart?: string };
    if (!period?.periodStart) {
      return;
    }
    const parsed = parseISO(period.periodStart);
    if (!lastDate || parsed > lastDate) {
      lastDate = parsed;
    }
  });
  return lastDate;
}

function maxDate(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function filterByMaxDate<T extends { periodStart: string }>(
  points: T[],
  maxDateValue: Date | null
) {
  if (!maxDateValue) {
    return points;
  }
  return points.filter((point) => parseISO(point.periodStart) <= maxDateValue);
}

function computeBarSize(length: number) {
  if (length <= 0) return 24;
  const base = Math.floor(700 / length);
  return Math.min(36, Math.max(12, base));
}

function computeTickInterval(length: number) {
  if (length <= 10) return 0;
  return Math.max(0, Math.floor(length / 8));
}

const absoluteValueLabel: LabelFormatter = (value) => {
  const numeric =
    typeof value === "number" ? value : value ? Number(value) : 0;
  if (Number.isNaN(numeric) || numeric === 0) {
    return "0";
  }
  return Math.abs(numeric).toString();
};

function normalizeAttrition(
  payload: Partial<AttritionResponse> | null | undefined
): AttritionResponse | null {
  if (!payload) {
    return null;
  }
  const safeOverall = Array.isArray(payload.overall) ? payload.overall : [];
  const safeEntities = Array.isArray(payload.entities) ? payload.entities : [];
  const safeAgeTrend = Array.isArray(payload.ageTrend) ? payload.ageTrend : [];
  const safeGenderTrend = Array.isArray(payload.genderTrend)
    ? payload.genderTrend
    : [];
  const safeTenureTrend = Array.isArray(payload.tenureTrend)
    ? payload.tenureTrend
    : [];

  return {
    overall: safeOverall.map((point) => ({
      label: point.label,
      attritionPct: toPercentFraction(point.attritionPct),
    })),
    entities: safeEntities.map((point) => ({
      entity: point.entity ?? null,
      label: point.label,
      attritionPct: toPercentFraction(point.attritionPct),
    })),
    ageTrend: safeAgeTrend.map((point) => ({
      label: point.label,
      twentyPct: toPercentFraction(point.twentyPct),
      thirtyPct: toPercentFraction(point.thirtyPct),
      fortyPct: toPercentFraction(point.fortyPct),
      fiftyPct: toPercentFraction(point.fiftyPct),
    })),
    genderTrend: safeGenderTrend.map((point) => ({
      label: point.label,
      malePct: toPercentFraction(point.malePct),
      femalePct: toPercentFraction(point.femalePct),
    })),
    tenureTrend: safeTenureTrend.map((point) => ({
      label: point.label,
      zeroSixPct: toPercentFraction(point.zeroSixPct),
      sixTwelvePct: toPercentFraction(point.sixTwelvePct),
      oneTwoPct: toPercentFraction(point.oneTwoPct),
      twoFourPct: toPercentFraction(point.twoFourPct),
      fourTenPct: toPercentFraction(point.fourTenPct),
      tenPlusPct: toPercentFraction(point.tenPlusPct),
    })),
  };
}

function toPercentFraction(value: number | string | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const hasPercentSuffix = trimmed.endsWith("%");
  const numericPortion = hasPercentSuffix ? trimmed.slice(0, -1) : trimmed;
  const parsed = Number(numericPortion);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return hasPercentSuffix ? parsed / 100 : parsed;
}

export default App;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatCurrencyValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  try {
    return currencyFormatter.format(value);
  } catch {
    return value.toLocaleString();
  }
}

function formatNumberValue(
  value?: number | null,
  digits = 0,
  suffix = ""
) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${formatted}${suffix}`;
}

function formatPercentValue(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(value)) {
    return "0%";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function averageCombine(
  current: number | null | undefined,
  incoming: number | null | undefined
) {
  if ((current == null || Number.isNaN(current)) && incoming != null) {
    return incoming;
  }
  if ((incoming == null || Number.isNaN(incoming)) && current != null) {
    return current;
  }
  if (
    current != null &&
    incoming != null &&
    !Number.isNaN(current) &&
    !Number.isNaN(incoming)
  ) {
    return (current + incoming) / 2;
  }
  return null;
}

function percentTickFormatter(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "0%";
  }
  return `${(value * 100).toFixed(0)}%`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

const percentLabelFormatter: LabelFormatter = (raw) => {
  const numeric =
    typeof raw === "number" ? raw : raw ? Number(raw) : 0;
  if (Number.isNaN(numeric)) {
    return "0";
  }
  return (numeric * 100).toFixed(0);
};
