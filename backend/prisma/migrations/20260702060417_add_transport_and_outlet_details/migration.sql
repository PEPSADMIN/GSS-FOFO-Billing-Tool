-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "acknowledgeNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "driverContactNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "lrDate" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "lrNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "poNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "transportMode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "transporterName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "vehicleRegNo" TEXT;

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN "bankAccountNo" TEXT;
ALTER TABLE "Outlet" ADD COLUMN "bankIfscCode" TEXT;
ALTER TABLE "Outlet" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Outlet" ADD COLUMN "cinNo" TEXT;
ALTER TABLE "Outlet" ADD COLUMN "regnAddress" TEXT;
