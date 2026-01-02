const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const XLSX = require("xlsx");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not defined. Please set it in server/.env before running the ingest script."
  );
}

const { Pool } = require("pg");
const serverRoot = path.resolve(__dirname, "..");
const prismaAdapterPath = path.join(
  serverRoot,
  "node_modules",
  "@prisma",
  "adapter-pg"
);
const prismaClientPath = path.join(
  serverRoot,
  "node_modules",
  "@prisma",
  "client"
);
const { PrismaPg } = require(prismaAdapterPath);
const { PrismaClient } = require(prismaClientPath);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHEET_CONFIG = {
  employees: {
    defaultName: "Employees",
    requiredColumns: ["Employee Name"],
  },
  education: {
    defaultName: "Education",
    requiredColumns: ["Highest Qualification", "New Emp ID"],
  },
  experience: {
    defaultName: "Experience",
    requiredColumns: [
      "Name of Previous Organization_Latest",
      "New Emp ID",
      "Emp ID",
    ],
  },
  ltip: {
    defaultName: "LTIP",
    requiredColumns: ["LTIP", "New Emp ID"],
  },
  dashboard: {
    defaultName: "EmployeeDashboard",
    requiredColumns: ["Employee Name", "New Emp ID"],
  },
};

const FIELD_TYPES = {
  string: "string",
  int: "int",
  float: "float",
  date: "date",
};

const EMPLOYEE_FIELD_MAP = {
  srNo: { column: "Sr No", type: FIELD_TYPES.int },
  oldEmpId: { column: "Old Emp ID", type: FIELD_TYPES.string },
  newEmpId: { column: "New Emp ID", type: FIELD_TYPES.string },
  employeeName: { column: "Employee Name", type: FIELD_TYPES.string },
  lwd: { column: "LWD (Last working day)", type: FIELD_TYPES.date },
  status: { column: "Status", type: FIELD_TYPES.string },
  employeePhysicalLocation: {
    column: "Employee Physical Location",
    type: FIELD_TYPES.string,
  },
  entityLocationPayroll: {
    column: "Entity Location as per Payroll",
    type: FIELD_TYPES.string,
  },
  employeeBranch: { column: "Employee Branch", type: FIELD_TYPES.string },
  currentAddress: { column: "Current_Address", type: FIELD_TYPES.string },
  permanantAddress: { column: "Permanant_Address", type: FIELD_TYPES.string },
  employeeCountry: { column: "Employee_Country", type: FIELD_TYPES.string },
  employeeState: { column: "Employee_State", type: FIELD_TYPES.string },
  employeeCity: { column: "Employee_City", type: FIELD_TYPES.string },
  internalGrade: {
    column: ["Internal Grade", "Worklevel", "Work level"],
    type: FIELD_TYPES.string,
  },
  internalDesignation: {
    column: "Internal Designation",
    type: FIELD_TYPES.string,
  },
  externalDesignation: {
    column: "External Designation",
    type: FIELD_TYPES.string,
  },
  sbu: { column: "SBU(Bussines Unit)", type: FIELD_TYPES.string },
  function: { column: "Function", type: FIELD_TYPES.string },
  department1: { column: "Department 1", type: FIELD_TYPES.string },
  department2: { column: "Department 2", type: FIELD_TYPES.string },
  role: { column: "Role", type: FIELD_TYPES.string },
  fixedCTC: { column: "Fixed CTC", type: FIELD_TYPES.float },
  variable: { column: "Variable", type: FIELD_TYPES.float },
  annualSalary: { column: "Annual Salary", type: FIELD_TYPES.float },
  position: { column: "position", type: FIELD_TYPES.string },
  entity: { column: "Entity", type: FIELD_TYPES.string },
  dob: { column: "DOB", type: FIELD_TYPES.date },
  doj: { column: "DOJ", type: FIELD_TYPES.date },
  reportingManager: {
    column: "Reporting manager",
    type: FIELD_TYPES.string,
  },
  officialEmail: { column: "Official Email Id", type: FIELD_TYPES.string },
  personalEmail: { column: "Personal Email ID", type: FIELD_TYPES.string },
  gender: { column: "Gender", type: FIELD_TYPES.string },
  bloodGroup: { column: "Blood Group", type: FIELD_TYPES.string },
  maritalStatus: { column: "Marital Status", type: FIELD_TYPES.string },
  pan: { column: "PAN", type: FIELD_TYPES.string },
  aadharNo: { column: "Aadhar No.", type: FIELD_TYPES.string },
  pfUan: { column: "PF UAN", type: FIELD_TYPES.string },
  pfNo: { column: "PF No.", type: FIELD_TYPES.string },
  mobileNo: { column: "Mobile No.", type: FIELD_TYPES.string },
  bankName: { column: "Bank Name", type: FIELD_TYPES.string },
  bankAcNo: { column: "Bank Ac no.", type: FIELD_TYPES.string },
  ifscNo: { column: "IFSC No.", type: FIELD_TYPES.string },
  emergencyContactName: {
    column: "Emergency Contact Name",
    type: FIELD_TYPES.string,
  },
  emergencyContactRelation: {
    column: "Emergency Contact Relationship",
    type: FIELD_TYPES.string,
  },
  emergencyContactNo: {
    column: "Emergency Contact No.",
    type: FIELD_TYPES.string,
  },
  spouseName: { column: "Spouse_Name", type: FIELD_TYPES.string },
  spouseDob: { column: "Spouse_Dob", type: FIELD_TYPES.date },
  child1Name: { column: "Child1_Name", type: FIELD_TYPES.string },
  child1Dob: { column: "Child1_DOB", type: FIELD_TYPES.date },
  child1Gender: { column: "Child1_Gender", type: FIELD_TYPES.string },
  child2Name: { column: "Child2_Name", type: FIELD_TYPES.string },
  child2Dob: { column: "Child2_DOB", type: FIELD_TYPES.date },
  child2Gender: { column: "Child2_Gender", type: FIELD_TYPES.string },
  child3Name: { column: "Child3_Name", type: FIELD_TYPES.string },
  child3Dob: { column: "Child3_DOB", type: FIELD_TYPES.date },
  child3Gender: { column: "Child3_Gender", type: FIELD_TYPES.string },
  fatherName: { column: "Father_Name", type: FIELD_TYPES.string },
  fatherDob: { column: "Father_DOB", type: FIELD_TYPES.date },
  motherName: { column: "Mother_Name", type: FIELD_TYPES.string },
  motherDob: { column: "Mother_DOB", type: FIELD_TYPES.date },
  totalExperienceYears: {
    column: "Total Yrs of Experience",
    type: FIELD_TYPES.float,
  },
  costCenterCode: { column: "Cost center code", type: FIELD_TYPES.string },
};

const EDUCATION_FIELD_MAP = {
  highestQualification: {
    column: "Highest Qualification",
    type: FIELD_TYPES.string,
  },
  instituteCollege: { column: "Institute/College", type: FIELD_TYPES.string },
  yearOfPassing: { column: "Year of Passing", type: FIELD_TYPES.string },
  secondQualification: {
    column: "2nd Highest Qualification",
    type: FIELD_TYPES.string,
  },
  instituteCollege2: { column: "Institute/College.1", type: FIELD_TYPES.string },
  yearOfPassing2: { column: "Year of Passing.1", type: FIELD_TYPES.string },
};

const EXPERIENCE_FIELD_MAP = {
  orgLatest: {
    column: "Name of Previous Organization_Latest",
    type: FIELD_TYPES.string,
  },
  roleLatest: { column: "Role/Designation", type: FIELD_TYPES.string },
  fromDateLatest: { column: "From Date", type: FIELD_TYPES.date },
  toDateLatest: { column: "To Date", type: FIELD_TYPES.date },
  org1: {
    column: "Name of Previous to Pevious Org",
    type: FIELD_TYPES.string,
  },
  designation1: { column: "Designation", type: FIELD_TYPES.string },
  fromDate1: { column: "From Date.1", type: FIELD_TYPES.date },
  toDate1: { column: "To Date.1", type: FIELD_TYPES.date },
  org2: {
    column: "Name of Previous to Pevious Org.1",
    type: FIELD_TYPES.string,
  },
  designation2: { column: "Designation.1", type: FIELD_TYPES.string },
  fromDate2: { column: "From Date.2", type: FIELD_TYPES.date },
  toDate2: { column: "To Date.2", type: FIELD_TYPES.date },
  org3: {
    column: "Name of Previous to Pevious Org.2",
    type: FIELD_TYPES.string,
  },
  designation3: { column: "Designation.2", type: FIELD_TYPES.string },
  fromDate3: { column: "From Date.3", type: FIELD_TYPES.date },
  toDate3: { column: "To Date.3", type: FIELD_TYPES.date },
  org4: {
    column: "Name of Previous to Pevious Org.3",
    type: FIELD_TYPES.string,
  },
  designation4: { column: "Designation.3", type: FIELD_TYPES.string },
  fromDate4: { column: "From Date.4", type: FIELD_TYPES.date },
  toDate4: { column: "To Date.4", type: FIELD_TYPES.date },
};

const LTIP_FIELD_MAP = {
  ltip: { column: "LTIP", type: FIELD_TYPES.float },
  ltipDate: { column: "LTIP DATE", type: FIELD_TYPES.date },
  recoveryDate: { column: "Recovery Date", type: FIELD_TYPES.date },
};

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const normalized = String(value).replace(/,/g, "").trim();
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function toUtcMidnight(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toUtcMidnight(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function excelSerialDateToJS(value) {
  if (value == null) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const timestamp = excelEpoch + value * 24 * 60 * 60 * 1000;
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 2100) {
    return null;
  }
  return new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
}

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return toUtcMidnight(value);
  if (typeof value === "number") {
    return excelSerialDateToJS(value);
  }

  const str = String(value).trim();
  if (!Number.isNaN(Number(str)) && str !== "") {
    return excelSerialDateToJS(Number(str));
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getUTCFullYear();
  if (year < 1900 || year > 2100) {
    return null;
  }
  return toUtcMidnight(parsed);
}

function yearsFrom(date) {
  if (!date || !(date instanceof Date)) {
    return null;
  }
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (Number.isNaN(diff) || diff < 0) return null;
  return Number((diff / (1000 * 60 * 60 * 24 * 365.25)).toFixed(2));
}

function formatMonthYear(date) {
  if (!date || !(date instanceof Date)) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeValue(rawValue, type) {
  switch (type) {
    case FIELD_TYPES.int: {
      const parsed = parseNumber(rawValue);
      return parsed === null ? null : Math.trunc(parsed);
    }
    case FIELD_TYPES.float:
      return parseNumber(rawValue);
    case FIELD_TYPES.date:
      return parseDate(rawValue);
    default:
      if (rawValue === null || rawValue === undefined) return null;
      const str = String(rawValue).trim();
      return str === "" ? null : str;
  }
}

function mapRow(row, mapping, extraFields = {}) {
  const data = { ...extraFields };
  const normalizedKeys = new Map();
  for (const key of Object.keys(row)) {
    if (!key) continue;
    normalizedKeys.set(key.trim().toLowerCase(), key);
  }

  for (const [field, meta] of Object.entries(mapping)) {
    if (!meta?.column) continue;
    const columnCandidates = Array.isArray(meta.column)
      ? meta.column
      : [meta.column];
    let rawValue = undefined;
    for (const candidate of columnCandidates) {
      if (!candidate) continue;
      const lookupKey = candidate.trim().toLowerCase();
      const actualKey = normalizedKeys.get(lookupKey) ?? candidate;
      if (!Object.prototype.hasOwnProperty.call(row, actualKey)) {
        continue;
      }
      rawValue = row[actualKey];
      if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
        break;
      }
      // keep searching if the current candidate is empty
      rawValue = undefined;
    }
    const value = normalizeValue(rawValue, meta.type);
    if (value !== null && value !== undefined) {
      data[field] = value;
    }
  }
  return data;
}

function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: null,
  });
}

function getSheetHeaders(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });
  const headerRow = rows[0] || [];
  return headerRow.map((cell) => (cell ? String(cell).trim() : ""));
}

function resolveSheetName(workbook, config) {
  const { defaultName, requiredColumns = [] } = config;
  if (workbook.SheetNames.includes(defaultName)) {
    return defaultName;
  }

  const normalizedRequirements = requiredColumns
    .filter(Boolean)
    .map((col) => col.trim().toLowerCase());

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const headers = getSheetHeaders(sheet).map((col) => col.toLowerCase());
    const matches = normalizedRequirements.every((col) => headers.includes(col));
    if (matches) {
      return name;
    }
  }
  return null;
}

function readSheetByKey(workbook, key) {
  const config = SHEET_CONFIG[key];
  if (!config) {
    throw new Error(`Unknown sheet key: ${key}`);
  }

  const sheetName = resolveSheetName(workbook, config);
  if (!sheetName) {
    console.warn(
      `Sheet "${config.defaultName}" not found and no matching sheet with required columns (${config.requiredColumns.join(
        ", "
      )}) was detected.`
    );
    return { rows: [], sheetName: null };
  }

  const rows = readSheet(workbook, sheetName);
  if (!rows.length) {
    console.warn(`Sheet "${sheetName}" is empty.`);
  }
  return { rows, sheetName };
}

function normalizeKey(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

function deriveMonthLabel(monthKey) {
  if (!monthKey) return null;
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  const label = MONTH_LABELS[month - 1];
  if (!label) return null;
  return `${label} ${year}`;
}

async function resolveOrganization({ orgName, orgCode }) {
  const name = orgName ? String(orgName).trim() : "";
  const code = orgCode ? String(orgCode).trim() : "";
  if (!name && !code) {
    return null;
  }
  const resolvedName = name || code;
  const resolvedCode = code || null;
  const rows = await prisma.$queryRaw`
    INSERT INTO "Organization" ("id", "name", "code")
    VALUES (${randomUUID()}, ${resolvedName}, ${resolvedCode})
    ON CONFLICT ("name")
    DO UPDATE SET "code" = COALESCE(EXCLUDED."code", "Organization"."code")
    RETURNING "id", "name", "code";
  `;
  return rows?.[0] ?? null;
}

async function resolveDashboardMonth({ monthKey, monthLabel }) {
  if (!monthKey) {
    return null;
  }
  const label = monthLabel || deriveMonthLabel(monthKey) || monthKey;
  const rows = await prisma.$queryRaw`
    INSERT INTO "DashboardMonth" ("id", "label", "monthKey")
    VALUES (${randomUUID()}, ${label}, ${monthKey})
    ON CONFLICT ("monthKey")
    DO UPDATE SET "label" = EXCLUDED."label"
    RETURNING "id", "label", "monthKey";
  `;
  return rows?.[0] ?? null;
}

async function ingestWorkbook(filePath, options = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const stats = {
    employees: 0,
    educations: 0,
    experiences: 0,
    ltip: 0,
    dashboards: 0,
    skippedEducation: 0,
    skippedExperience: 0,
    skippedDashboard: 0,
    skippedLtip: 0,
  };

  const organization = await resolveOrganization(options);
  const dashboardMonth = await resolveDashboardMonth(options);
  const upload = await prisma.upload.create({
    data: {
      filename: path.basename(filePath),
    },
  });
  if (organization?.id || dashboardMonth?.id) {
    await prisma.$executeRaw`
      UPDATE "Upload"
      SET
        "organizationId" = ${organization?.id ?? null},
        "dashboardMonthId" = ${dashboardMonth?.id ?? null}
      WHERE "id" = ${upload.id};
    `;
  }

  const { rows: employeeRows, sheetName: employeeSheetName } = readSheetByKey(
    workbook,
    "employees"
  );
  if (!employeeRows.length) {
    throw new Error(
      `Sheet "${
        employeeSheetName || SHEET_CONFIG.employees.defaultName
      }" is required and must contain at least one row.`
    );
  }

  const employeeKeyMap = new Map();
  const employeeRecords = [];

  for (const row of employeeRows) {
    const employeeData = mapRow(row, EMPLOYEE_FIELD_MAP, {
      uploadId: upload.id,
    });

    if (
      !employeeData.newEmpId &&
      !employeeData.oldEmpId &&
      !employeeData.employeeName
    ) {
      continue;
    }

    const id = randomUUID();
    employeeData.id = id;
    employeeRecords.push(employeeData);

    const keyVariants = [
      normalizeKey(employeeData.newEmpId),
      normalizeKey(employeeData.oldEmpId),
      normalizeKey(employeeData.employeeName),
    ];

    for (const key of keyVariants) {
      if (key) {
        employeeKeyMap.set(key, id);
      }
    }

    stats.employees += 1;
  }

  await insertInChunks("employee", employeeRecords);

  const educationRecords = buildChildRows({
    rows: employeeRows,
    fieldMap: EDUCATION_FIELD_MAP,
    employeeKeyMap,
    uploadId: upload.id,
    stats,
    statsKey: "educations",
    skippedKey: "skippedEducation",
  });
  await insertInChunks("education", educationRecords);

  const experienceRecords = buildChildRows({
    rows: employeeRows,
    fieldMap: EXPERIENCE_FIELD_MAP,
    employeeKeyMap,
    uploadId: upload.id,
    stats,
    statsKey: "experiences",
    skippedKey: "skippedExperience",
  });
  await insertInChunks("experience", experienceRecords);

  const ltipRecords = buildChildRows({
    rows: employeeRows,
    fieldMap: LTIP_FIELD_MAP,
    employeeKeyMap,
    uploadId: upload.id,
    stats,
    statsKey: "ltip",
    skippedKey: "skippedLtip",
    enforceUniqueEmployee: true,
  });
  await insertInChunks("lTIP", ltipRecords);

  const dashboardRecords = [];
  for (const employee of employeeRecords) {
    const identifier =
      employee.newEmpId || employee.oldEmpId || employee.employeeName;
    if (!identifier) {
      stats.skippedDashboard += 1;
      continue;
    }

    const dobYears = yearsFrom(employee.dob);
    const tenureYears = yearsFrom(employee.doj);

    dashboardRecords.push({
      id: randomUUID(),
      uploadId: upload.id,
      empId: employee.newEmpId || employee.oldEmpId || null,
      newEmpId: employee.newEmpId || null,
      employeeName: employee.employeeName || null,
      finalLwd: employee.lwd || null,
      employeePhysicalLocation: employee.employeePhysicalLocation || null,
      designation:
        employee.internalDesignation ||
        employee.externalDesignation ||
        null,
      entity: employee.entity || null,
      doj: employee.doj || null,
      dob: employee.dob || null,
      gender: employee.gender || null,
      ctc: employee.annualSalary || employee.fixedCTC || null,
      month: formatMonthYear(employee.doj),
      age: dobYears,
      tenure: tenureYears,
      presentation: null,
      dynamicStartDate: employee.doj || null,
      hires: employee.doj ? 1 : null,
      worklevel: employee.position || null,
    });
  }
  stats.dashboards = dashboardRecords.length;
  await insertInChunks("employeeDashboard", dashboardRecords);
  if (organization?.id || dashboardMonth?.id) {
    await prisma.$executeRaw`
      UPDATE "employee_dashboard_master"
      SET
        "organizationId" = ${organization?.id ?? null},
        "dashboardMonthId" = ${dashboardMonth?.id ?? null}
      WHERE "uploadId" = ${upload.id};
    `;
  }

  return { uploadId: upload.id, stats };
}

function buildChildRows({
  rows,
  fieldMap,
  employeeKeyMap,
  uploadId,
  stats,
  statsKey,
  skippedKey,
  enforceUniqueEmployee = false,
}) {
  const records = [];
  const seenEmployees = new Set();

  for (const row of rows) {
    const key =
      normalizeKey(row["New Emp ID"]) ||
      normalizeKey(row["Emp ID"]) ||
      normalizeKey(row["Employee Name"]);
    const employeeId = key ? employeeKeyMap.get(key) : null;
    if (!employeeId) {
      stats[skippedKey] += 1;
      continue;
    }

    if (enforceUniqueEmployee) {
      if (seenEmployees.has(employeeId)) {
        continue;
      }
      seenEmployees.add(employeeId);
    }

    const record = mapRow(row, fieldMap, {
      employeeId,
      uploadId,
    });
    record.id = randomUUID();
    records.push(record);
    stats[statsKey] += 1;
  }

  return records;
}

const MODEL_MAP = {
  employee: (data) => prisma.employee.createMany({ data }),
  education: (data) => prisma.education.createMany({ data }),
  experience: (data) => prisma.experience.createMany({ data }),
  lTIP: (data) => prisma.lTIP.createMany({ data, skipDuplicates: true }),
  employeeDashboard: (data) =>
    prisma.employeeDashboard.createMany({ data }),
};

async function insertInChunks(modelName, rows, chunkSize = 500) {
  if (!rows.length) {
    return;
  }

  const insertFn = MODEL_MAP[modelName];
  if (!insertFn) {
    throw new Error(`Unsupported model for bulk insert: ${modelName}`);
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await insertFn(chunk);
  }
}

function parseArgs(argv) {
  const options = {};
  let excelPath = null;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (!arg.startsWith("--") && !excelPath) {
      excelPath = arg;
      continue;
    }
    if (arg === "--org-name") {
      options.orgName = argv[i + 1];
      i += 1;
    } else if (arg === "--org-code") {
      options.orgCode = argv[i + 1];
      i += 1;
    } else if (arg === "--month-key") {
      options.monthKey = argv[i + 1];
      i += 1;
    } else if (arg === "--month-label") {
      options.monthLabel = argv[i + 1];
      i += 1;
    }
  }

  return { excelPath, options };
}

async function main() {
  const { excelPath, options } = parseArgs(process.argv);
  if (!excelPath) {
    console.error("Usage: npm run ingest -- <path-to-excel-file>");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), excelPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  try {
    const result = await ingestWorkbook(absolutePath, options);
    console.log(
      JSON.stringify({
        status: "success",
        ...result,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "error",
        message: error?.message || "Unknown error",
        stack: error?.stack,
      })
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    if (typeof pool.end === "function") {
      await pool.end();
    }
  }
}

main();
