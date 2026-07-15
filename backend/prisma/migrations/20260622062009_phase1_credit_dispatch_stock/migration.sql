-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "creditLimit" INTEGER;

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outletId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "vehicleNo" TEXT,
    "lrNo" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dispatchedAt" DATETIME,
    "podReceivedAt" DATETIME,
    "podNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dispatch_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispatch_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_invoiceId_key" ON "Dispatch"("invoiceId");

-- CreateIndex
CREATE INDEX "Dispatch_outletId_status_idx" ON "Dispatch"("outletId", "status");
