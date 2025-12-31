-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "dashboardMonthId" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "employee_dashboard_master" ADD COLUMN     "dashboardMonthId" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardMonth" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,

    CONSTRAINT "DashboardMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardMonth_monthKey_key" ON "DashboardMonth"("monthKey");

-- CreateIndex
CREATE INDEX "Upload_organizationId_dashboardMonthId_idx" ON "Upload"("organizationId", "dashboardMonthId");

-- CreateIndex
CREATE INDEX "employee_dashboard_master_organizationId_dashboardMonthId_idx" ON "employee_dashboard_master"("organizationId", "dashboardMonthId");

-- AddForeignKey
ALTER TABLE "employee_dashboard_master" ADD CONSTRAINT "employee_dashboard_master_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_dashboard_master" ADD CONSTRAINT "employee_dashboard_master_dashboardMonthId_fkey" FOREIGN KEY ("dashboardMonthId") REFERENCES "DashboardMonth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_dashboardMonthId_fkey" FOREIGN KEY ("dashboardMonthId") REFERENCES "DashboardMonth"("id") ON DELETE SET NULL ON UPDATE CASCADE;
