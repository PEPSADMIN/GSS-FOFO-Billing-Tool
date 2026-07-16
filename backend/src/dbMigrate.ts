import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "Outlet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "panCode" TEXT,
    "cinNo" TEXT,
    "addressLine" TEXT NOT NULL,
    "regnAddress" TEXT,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankIfscCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Outlet_gstin_key" ON "Outlet"("gstin")`,

  `CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tabs" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Role_outletId_name_key" ON "Role"("outletId", "name")`,

  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "customRoleId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "themeId" TEXT NOT NULL DEFAULT 'royal-gold',
    "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "customBackground" TEXT,
    "customTextColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`,

  `CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
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
    "creditLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Customer_outletId_customerCode_key" ON "Customer"("outletId", "customerCode")`,
  `CREATE INDEX IF NOT EXISTS "Customer_outletId_phone_idx" ON "Customer"("outletId", "phone")`,
  `CREATE INDEX IF NOT EXISTS "Customer_outletId_name_idx" ON "Customer"("outletId", "name")`,

  `CREATE TABLE IF NOT EXISTS "CustomerAddress" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "CustomerAddress_outletId_customerId_idx" ON "CustomerAddress"("outletId", "customerId")`,

  `CREATE TABLE IF NOT EXISTS "Item" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsnCode" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL,
    "price" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Item_outletId_name_idx" ON "Item"("outletId", "name")`,

  `CREATE TABLE IF NOT EXISTS "CustomerItem" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "customPrice" INTEGER,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerItem_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CustomerItem_customerId_itemId_key" ON "CustomerItem"("customerId", "itemId")`,
  `CREATE INDEX IF NOT EXISTS "CustomerItem_outletId_customerId_idx" ON "CustomerItem"("outletId", "customerId")`,

  `CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "resultingStock" INTEGER NOT NULL,
    "referenceInvoiceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_outletId_itemId_createdAt_idx" ON "StockMovement"("outletId", "itemId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "InvoiceCounter" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceCounter_outletId_financialYear_key" ON "InvoiceCounter"("outletId", "financialYear")`,

  `CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "financialYear" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "isInterState" BOOLEAN NOT NULL,
    "taxableValue" INTEGER NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_outletId_financialYear_sequenceNo_key" ON "Invoice"("outletId", "financialYear", "sequenceNo")`,
  `CREATE INDEX IF NOT EXISTS "Invoice_outletId_createdAt_idx" ON "Invoice"("outletId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "Installment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "interestRate" DOUBLE PRECISION,
    "documentCharges" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Installment_outletId_dueDate_idx" ON "Installment"("outletId", "dueDate")`,
  `CREATE INDEX IF NOT EXISTS "Installment_invoiceId_idx" ON "Installment"("invoiceId")`,

  `CREATE TABLE IF NOT EXISTS "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "hsnCode" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL,
    "taxableValue" INTEGER NOT NULL,
    "cgstAmount" INTEGER NOT NULL DEFAULT 0,
    "sgstAmount" INTEGER NOT NULL DEFAULT 0,
    "igstAmount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Dispatch" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "vehicleNo" TEXT,
    "lrNo" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dispatchedAt" TIMESTAMP(3),
    "podReceivedAt" TIMESTAMP(3),
    "podNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Dispatch_invoiceId_key" ON "Dispatch"("invoiceId")`,
  `CREATE INDEX IF NOT EXISTS "Dispatch_outletId_status_idx" ON "Dispatch"("outletId", "status")`,

  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_outletId_createdAt_idx" ON "AuditLog"("outletId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_outletId_entityType_entityId_idx" ON "AuditLog"("outletId", "entityType", "entityId")`,

  `CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Announcement_outletId_createdAt_idx" ON "Announcement"("outletId", "createdAt")`,
];

export async function migrate(): Promise<void> {
  console.log("[migrate] Initialising PostgreSQL schema...");
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  const outletCount = await prisma.outlet.count();
  if (outletCount === 0) {
    console.log("[migrate] Fresh database — seeding initial data...");
    const outlet = await prisma.outlet.upsert({
      where: { gstin: "27ABCDE1234F1Z5" },
      update: {},
      create: {
        name: "Sharma General Store",
        gstin: "27ABCDE1234F1Z5",
        stateCode: "27",
        addressLine: "Shop No. 4, MG Road",
        city: "Mumbai",
        pincode: "400001",
        phone: "9876543210",
      },
    });
    const passwordHash = await bcrypt.hash("password123", 10);
    await prisma.user.upsert({
      where: { phone: "9999999999" },
      update: {},
      create: {
        outletId: outlet.id,
        name: "Owner",
        phone: "9999999999",
        passwordHash,
        role: "OWNER",
      },
    });
    console.log(`[migrate] Seeded outlet "${outlet.name}" — login 9999999999 / password123`);
  }

  await prisma.$disconnect();
  console.log("[migrate] Schema ready.");
}
