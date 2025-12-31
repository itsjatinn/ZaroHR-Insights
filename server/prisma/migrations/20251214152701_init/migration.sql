-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "uploadId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "uploadId" TEXT;

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "uploadId" TEXT;

-- AlterTable
ALTER TABLE "LTIP" ADD COLUMN     "uploadId" TEXT;

-- AlterTable
ALTER TABLE "employee_dashboard_master" ADD COLUMN     "uploadId" TEXT;

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "filename" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LTIP" ADD CONSTRAINT "LTIP_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_dashboard_master" ADD CONSTRAINT "employee_dashboard_master_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
