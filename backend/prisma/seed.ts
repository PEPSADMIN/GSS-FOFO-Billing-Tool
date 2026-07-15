import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const outlet = await prisma.outlet.upsert({
    where: { gstin: "27ABCDE1234F1Z5" },
    update: {},
    create: {
      name: "Sharma General Store",
      gstin: "27ABCDE1234F1Z5",
      stateCode: "27", // Maharashtra
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

  const customer1 = {
    name: "Rohan Mehta",
    email: "rohan.mehta@example.com",
    phone: "9000000001",
    addressLine1: "12 Linking Road",
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    stateCode: "27", // same state as outlet -> intra-state
  };
  await prisma.customer.upsert({
    where: { outletId_customerCode: { outletId: outlet.id, customerCode: "C0001" } },
    update: customer1,
    create: { outletId: outlet.id, customerCode: "C0001", ...customer1 },
  });

  const customer2 = {
    name: "Priya Rao",
    email: "priya.rao@example.com",
    phone: "9000000002",
    addressLine1: "45 MG Road",
    city: "Bengaluru",
    district: "Bengaluru Urban",
    state: "Karnataka",
    pincode: "560001",
    stateCode: "29", // Karnataka -> inter-state
  };
  await prisma.customer.upsert({
    where: { outletId_customerCode: { outletId: outlet.id, customerCode: "C0002" } },
    update: customer2,
    create: { outletId: outlet.id, customerCode: "C0002", ...customer2 },
  });

  await prisma.item.upsert({
    where: { id: "seed-item-shirt" },
    update: {},
    create: {
      id: "seed-item-shirt",
      outletId: outlet.id,
      name: "Cotton Shirt",
      hsnCode: "6105",
      unit: "PCS",
      gstRate: 18.0,
      price: 100000, // ₹1000.00
      currentStock: 50,
      lowStockThreshold: 5,
    },
  });

  await prisma.item.upsert({
    where: { id: "seed-item-jeans" },
    update: {},
    create: {
      id: "seed-item-jeans",
      outletId: outlet.id,
      name: "Denim Jeans",
      hsnCode: "6203",
      unit: "PCS",
      gstRate: 12.0,
      price: 150000, // ₹1500.00
      currentStock: 30,
      lowStockThreshold: 5,
    },
  });

  console.log("Seed complete.");
  console.log(`Outlet: ${outlet.name} (${outlet.id})`);
  console.log("Login with phone 9999999999 / password password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
