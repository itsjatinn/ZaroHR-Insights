-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "Sr No" INTEGER,
    "Old Emp ID" TEXT,
    "New Emp ID" TEXT,
    "Employee Name" TEXT,
    "LWD (Last working day)" TIMESTAMP(3),
    "Status" TEXT,
    "Employee Physical Location" TEXT,
    "Entity Location as per Payroll" TEXT,
    "Employee Branch" TEXT,
    "Current_Address" TEXT,
    "Permanant_Address" TEXT,
    "Employee_Country" TEXT,
    "Employee_State" TEXT,
    "Employee_City" TEXT,
    "Internal Grade" TEXT,
    "Internal Designation" TEXT,
    "External Designation" TEXT,
    "SBU(Bussines Unit)" TEXT,
    "Function" TEXT,
    "Department 1" TEXT,
    "Department 2" TEXT,
    "Role" TEXT,
    "Fixed CTC" DOUBLE PRECISION,
    "Variable" DOUBLE PRECISION,
    "Annual Salary" DOUBLE PRECISION,
    "position" TEXT,
    "Entity" TEXT,
    "DOB" TIMESTAMP(3),
    "DOJ" TIMESTAMP(3),
    "Reporting manager" TEXT,
    "Official Email Id" TEXT,
    "Personal Email ID" TEXT,
    "Gender" TEXT,
    "Blood Group" TEXT,
    "Marital Status" TEXT,
    "PAN" TEXT,
    "Aadhar No." TEXT,
    "PF UAN" TEXT,
    "PF No." TEXT,
    "Mobile No." TEXT,
    "Bank Name" TEXT,
    "Bank Ac no." TEXT,
    "IFSC No." TEXT,
    "Emergency Contact Name" TEXT,
    "Emergency Contact Relationship" TEXT,
    "Emergency Contact No." TEXT,
    "Spouse_Name" TEXT,
    "Spouse_Dob" TIMESTAMP(3),
    "Child1_Name" TEXT,
    "Child1_DOB" TIMESTAMP(3),
    "Child1_Gender" TEXT,
    "Child2_Name" TEXT,
    "Child2_DOB" TIMESTAMP(3),
    "Child2_Gender" TEXT,
    "Child3_Name" TEXT,
    "Child3_DOB" TIMESTAMP(3),
    "Child3_Gender" TEXT,
    "Father_Name" TEXT,
    "Father_DOB" TIMESTAMP(3),
    "Mother_Name" TEXT,
    "Mother_DOB" TIMESTAMP(3),
    "Total Yrs of Experience" DOUBLE PRECISION,
    "Cost center code" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "Highest Qualification" TEXT,
    "Institute/College" TEXT,
    "Year of Passing" TEXT,
    "2nd Highest Qualification" TEXT,
    "Institute/College.1" TEXT,
    "Year of Passing.1" TEXT,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "Name of Previous Organization_Latest" TEXT,
    "Role/Designation" TEXT,
    "From Date" TIMESTAMP(3),
    "To Date" TIMESTAMP(3),
    "Name of Previous to Pevious Org" TEXT,
    "Designation" TEXT,
    "From Date.1" TIMESTAMP(3),
    "To Date.1" TIMESTAMP(3),
    "Name of Previous to Pevious Org.1" TEXT,
    "Designation.1" TEXT,
    "From Date.2" TIMESTAMP(3),
    "To Date.2" TIMESTAMP(3),
    "Name of Previous to Pevious Org.2" TEXT,
    "Designation.2" TEXT,
    "From Date.3" TIMESTAMP(3),
    "To Date.3" TIMESTAMP(3),
    "Name of Previous to Pevious Org.3" TEXT,
    "Designation.3" TEXT,
    "From Date.4" TIMESTAMP(3),
    "To Date.4" TIMESTAMP(3),

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LTIP" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "LTIP" DOUBLE PRECISION,
    "LTIP DATE" TIMESTAMP(3),
    "Recovery Date" TIMESTAMP(3),

    CONSTRAINT "LTIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_dashboard_master" (
    "id" TEXT NOT NULL,
    "Emp ID" TEXT,
    "New Emp ID" TEXT,
    "Employee Name" TEXT,
    "Final LWD" TIMESTAMP(3),
    "Employee Physical Location" TEXT,
    "Designation" TEXT,
    "Entity" TEXT,
    "DOJ" TIMESTAMP(3),
    "DOB" TIMESTAMP(3),
    "Gender" TEXT,
    "CTC" DOUBLE PRECISION,
    "Month" TEXT,
    "Age" DOUBLE PRECISION,
    "Tenure" DOUBLE PRECISION,
    "Presentation" TEXT,
    "DYANMIC START DATE" TIMESTAMP(3),
    "Hires" INTEGER,
    "Worklevel" TEXT,

    CONSTRAINT "employee_dashboard_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LTIP_employeeId_key" ON "LTIP"("employeeId");

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LTIP" ADD CONSTRAINT "LTIP_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
