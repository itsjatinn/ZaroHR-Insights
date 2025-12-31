CREATE TABLE "DashboardConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "chartKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardConfig_organizationId_chartKey_key"
  ON "DashboardConfig"("organizationId", "chartKey");

CREATE INDEX "DashboardConfig_organizationId_idx"
  ON "DashboardConfig"("organizationId");

ALTER TABLE "DashboardConfig"
  ADD CONSTRAINT "DashboardConfig_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
