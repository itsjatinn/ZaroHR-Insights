-- CreateTable
CREATE TABLE "DashboardRelease" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dashboardMonthId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardRelease_organizationId_dashboardMonthId_key" ON "DashboardRelease"("organizationId", "dashboardMonthId");

-- CreateIndex
CREATE INDEX "DashboardRelease_organizationId_idx" ON "DashboardRelease"("organizationId");

-- CreateIndex
CREATE INDEX "DashboardRelease_dashboardMonthId_idx" ON "DashboardRelease"("dashboardMonthId");

-- AddForeignKey
ALTER TABLE "DashboardRelease" ADD CONSTRAINT "DashboardRelease_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardRelease" ADD CONSTRAINT "DashboardRelease_dashboardMonthId_fkey" FOREIGN KEY ("dashboardMonthId") REFERENCES "DashboardMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
