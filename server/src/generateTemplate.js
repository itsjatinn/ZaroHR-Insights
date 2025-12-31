const path = require("path");
const ExcelJS = require("exceljs");

const EMPLOYEE_HEADERS = [
  "Sr No",
  "Old Emp ID",
  "New Emp ID",
  "Employee Name",
  "LWD (Last working day)",
  "Status",
  "Employee Physical Location",
  "Entity Location as per Payroll",
  "Employee Branch",
  "Current_Address",
  "Permanant_Address",
  "Employee_Country",
  "Employee_State",
  "Employee_City",
  "Internal Grade",
  "Internal Designation",
  "External Designation",
  "SBU(Bussines Unit)",
  "Function",
  "Department 1",
  "Department 2",
  "Role",
  "Fixed CTC",
  "Variable",
  "Annual Salary",
  "position",
  "Entity",
  "DOB",
  "DOJ",
  "Reporting manager",
  "Official Email Id",
  "Personal Email ID",
  "Gender",
  "Blood Group",
  "Marital Status",
  "PAN",
  "Aadhar No.",
  "PF UAN",
  "PF No.",
  "Mobile No.",
  "Bank Name",
  "Bank Ac no.",
  "IFSC No.",
  "Emergency Contact Name",
  "Emergency Contact Relationship",
  "Emergency Contact No.",
  "Spouse_Name",
  "Spouse_Dob",
  "Child1_Name",
  "Child1_DOB",
  "Child1_Gender",
  "Child2_Name",
  "Child2_DOB",
  "Child2_Gender",
  "Child3_Name",
  "Child3_DOB",
  "Child3_Gender",
  "Father_Name",
  "Father_DOB",
  "Mother_Name",
  "Mother_DOB",
  "Total Yrs of Experience",
  "Cost center code",
  "Highest Qualification",
  "Institute/College",
  "Year of Passing",
  "2nd Highest Qualification",
  "Institute/College.1",
  "Year of Passing.1",
  "Name of Previous Organization_Latest",
  "Role/Designation",
  "From Date",
  "To Date",
  "Name of Previous to Pevious Org",
  "Designation",
  "From Date.1",
  "To Date.1",
  "Name of Previous to Pevious Org.1",
  "Designation.1",
  "From Date.2",
  "To Date.2",
  "Name of Previous to Pevious Org.2",
  "Designation.2",
  "From Date.3",
  "To Date.3",
  "Name of Previous to Pevious Org.3",
  "Designation.3",
  "From Date.4",
  "To Date.4",
  "LTIP",
  "LTIP DATE",
  "Recovery Date",
];

const EXAMPLE_ROW = {
  "Sr No": 1,
  "New Emp ID": "EMP-001",
  "Employee Name": "Avery Jordan",
  "Status": "Active",
  "Employee Physical Location": "Bangalore",
  "Internal Grade": "G5",
  "Internal Designation": "Sr Analyst",
  "Function": "Analytics",
  "Department 1": "HR",
  "Role": "People Ops",
  "Entity": "North Hub",
  "DOB": "1991-04-12",
  "DOJ": "2022-06-01",
  "Official Email Id": "avery@company.com",
  "Gender": "Female",
  "Marital Status": "Single",
  "Annual Salary": 1450000,
  "Highest Qualification": "MBA",
  "Institute/College": "IIM Bangalore",
  "Year of Passing": "2014",
  "Name of Previous Organization_Latest": "ABC Corp",
  "Role/Designation": "HR Analyst",
  "From Date": "2018-07-01",
  "To Date": "2022-05-31",
  "LTIP": 120000,
  "LTIP DATE": "2024-01-15",
  "Recovery Date": "2025-01-15",
};

const VALIDATIONS = {
  "Status": {
    type: "list",
    allowBlank: true,
    formulae: ['"Active,Inactive,Exited"'],
  },
  "Gender": {
    type: "list",
    allowBlank: true,
    formulae: ['"Male,Female,Other"'],
  },
  "Marital Status": {
    type: "list",
    allowBlank: true,
    formulae: ['"Single,Married,Divorced,Separated,Widowed"'],
  },
  "Blood Group": {
    type: "list",
    allowBlank: true,
    formulae: ['"A+,A-,B+,B-,AB+,AB-,O+,O-"'],
  },
};

const DATE_COLUMNS = [
  "LWD (Last working day)",
  "DOB",
  "DOJ",
  "Spouse_Dob",
  "Child1_DOB",
  "Child2_DOB",
  "Child3_DOB",
  "Father_DOB",
  "Mother_DOB",
  "From Date",
  "To Date",
  "From Date.1",
  "To Date.1",
  "From Date.2",
  "To Date.2",
  "From Date.3",
  "To Date.3",
  "From Date.4",
  "To Date.4",
  "LTIP DATE",
  "Recovery Date",
];

const COLUMN_WIDTHS = {
  "Employee Name": 24,
  "Employee Physical Location": 22,
  "Entity Location as per Payroll": 26,
  "Internal Designation": 22,
  "External Designation": 22,
  "Official Email Id": 26,
  "Personal Email ID": 26,
  "Emergency Contact Relationship": 30,
  "Name of Previous Organization_Latest": 30,
  "Institute/College": 26,
  "Institute/College.1": 26,
};

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function applyHeaderStyle(cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
}

async function buildTemplate(outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ZaroHR Insights";
  workbook.created = new Date();

  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Guidance", key: "guidance", width: 80 },
  ];
  instructions.getRow(1).font = { bold: true };
  instructions.addRows([
    {
      field: "Required sheet",
      guidance: 'Use the "Employees" sheet. Do not rename headers.',
    },
    {
      field: "Dates",
      guidance: "Use YYYY-MM-DD (e.g., 2024-09-30).",
    },
    {
      field: "Identifiers",
      guidance: "Provide New Emp ID or Old Emp ID for each employee.",
    },
    {
      field: "Education/Experience",
      guidance:
        "Fill the education/experience columns in the same row as the employee.",
    },
    {
      field: "Uploads",
      guidance: "One row equals one employee profile.",
    },
  ]);

  const sheet = workbook.addWorksheet("Employees");
  sheet.columns = EMPLOYEE_HEADERS.map((header) => ({
    header,
    key: header,
    width: COLUMN_WIDTHS[header] || 18,
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => applyHeaderStyle(cell));

  sheet.addRow(
    EMPLOYEE_HEADERS.map((header) => EXAMPLE_ROW[header] ?? "")
  );
  sheet.getRow(2).font = { color: { argb: "FF334155" } };

  const headerToIndex = EMPLOYEE_HEADERS.reduce((acc, header, index) => {
    acc[header] = index + 1;
    return acc;
  }, {});

  Object.entries(VALIDATIONS).forEach(([header, validation]) => {
    const colIndex = headerToIndex[header];
    if (!colIndex) return;
    for (let row = 2; row <= 200; row += 1) {
      sheet.getCell(row, colIndex).dataValidation = validation;
    }
  });

  DATE_COLUMNS.forEach((header) => {
    const colIndex = headerToIndex[header];
    if (!colIndex) return;
    for (let row = 2; row <= 200; row += 1) {
      sheet.getCell(row, colIndex).dataValidation = {
        type: "date",
        operator: "between",
        allowBlank: true,
        formulae: ["DATE(1900,1,1)", "DATE(2100,12,31)"],
        showErrorMessage: true,
        errorTitle: "Invalid date",
        error: "Use YYYY-MM-DD date format.",
      };
    }
  });

  await workbook.xlsx.writeFile(path.resolve(outputPath));
}

const outputPath = getArg("--out");
if (!outputPath) {
  console.error("Usage: node src/generateTemplate.js --out <path>");
  process.exit(1);
}

buildTemplate(outputPath).catch((error) => {
  console.error(error?.message || "Failed to generate template.");
  process.exit(1);
});
