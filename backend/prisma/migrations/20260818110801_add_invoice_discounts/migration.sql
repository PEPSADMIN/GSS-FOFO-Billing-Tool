-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outletId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "financialYear" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "isInterState" BOOLEAN NOT NULL,
    "taxableValue" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "discountsSnapshot" TEXT,
    "cgstAmount" INTEGER NOT NULL DEFAULT 0,
    "sgstAmount" INTEGER NOT NULL DEFAULT 0,
    "igstAmount" INTEGER NOT NULL DEFAULT 0,
    "roundOff" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "billToAddressId" TEXT,
    "billToSnapshot" TEXT,
    "shipToAddressId" TEXT,
    "shipToSnapshot" TEXT,
    "ewayBillNo" TEXT,
    "cinNumber" TEXT,
    "acknowledgeNo" TEXT,
    "transportMode" TEXT,
    "transporterName" TEXT,
    "vehicleRegNo" TEXT,
    "driverContactNo" TEXT,
    "poNo" TEXT,
    "lrNo" TEXT,
    "lrDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("acknowledgeNo", "amountPaid", "billToAddressId", "billToSnapshot", "cgstAmount", "cinNumber", "createdAt", "createdByUserId", "customerId", "driverContactNo", "ewayBillNo", "financialYear", "grandTotal", "id", "igstAmount", "invoiceNumber", "isInterState", "lrDate", "lrNo", "outletId", "poNo", "roundOff", "sequenceNo", "sgstAmount", "shipToAddressId", "shipToSnapshot", "status", "taxableValue", "transportMode", "transporterName", "vehicleRegNo") SELECT "acknowledgeNo", "amountPaid", "billToAddressId", "billToSnapshot", "cgstAmount", "cinNumber", "createdAt", "createdByUserId", "customerId", "driverContactNo", "ewayBillNo", "financialYear", "grandTotal", "id", "igstAmount", "invoiceNumber", "isInterState", "lrDate", "lrNo", "outletId", "poNo", "roundOff", "sequenceNo", "sgstAmount", "shipToAddressId", "shipToSnapshot", "status", "taxableValue", "transportMode", "transporterName", "vehicleRegNo" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_outletId_createdAt_idx" ON "Invoice"("outletId", "createdAt");
CREATE UNIQUE INDEX "Invoice_outletId_financialYear_sequenceNo_key" ON "Invoice"("outletId", "financialYear", "sequenceNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
