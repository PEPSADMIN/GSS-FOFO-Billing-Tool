-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "billToAddressId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "billToSnapshot" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "shipToAddressId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "shipToSnapshot" TEXT;

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outletId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "stateCode" TEXT,
    "gstin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAddress_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomerAddress_outletId_customerId_idx" ON "CustomerAddress"("outletId", "customerId");
