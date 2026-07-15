/*
  Warnings:

  - You are about to drop the column `addressLine` on the `Customer` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outletId" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "alternateMobile" TEXT,
    "email" TEXT,
    "company" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "stateCode" TEXT,
    "panCode" TEXT,
    "gstin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("city", "createdAt", "customerCode", "email", "gstin", "id", "name", "outletId", "phone", "stateCode") SELECT "city", "createdAt", "customerCode", "email", "gstin", "id", "name", "outletId", "phone", "stateCode" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_outletId_phone_idx" ON "Customer"("outletId", "phone");
CREATE UNIQUE INDEX "Customer_outletId_customerCode_key" ON "Customer"("outletId", "customerCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
