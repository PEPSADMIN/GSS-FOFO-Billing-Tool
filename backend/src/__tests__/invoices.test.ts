import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../app";
import { prisma } from "../prisma";

let token: string;
let outletId: string;
let itemId: string;

async function createInvoice(customerId: string, quantity: number, paidAmount: number) {
  return request(app)
    .post("/api/invoices")
    .set("Authorization", `Bearer ${token}`)
    .send({
      customerId,
      lineItems: [{ itemId, quantity }],
      payments: paidAmount > 0 ? [{ mode: "CASH", amount: paidAmount }] : [],
    });
}

beforeAll(async () => {
  const outlet = await prisma.outlet.create({
    data: { name: "Test Outlet", gstin: "27TESTGST1234F1Z5", stateCode: "27", addressLine: "1 Test St", city: "Mumbai", pincode: "400001" },
  });
  outletId = outlet.id;

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: { outletId, name: "Test Owner", phone: "9000000099", passwordHash, role: "OWNER" },
  });

  const item = await prisma.item.create({
    data: { outletId, name: "Test Mattress", hsnCode: "9404", unit: "PCS", gstRate: 18, price: 100000, currentStock: 10, lowStockThreshold: 2 },
  });
  itemId = item.id;

  const loginRes = await request(app).post("/api/auth/login").send({ phone: "9000000099", password: "password123" });
  token = loginRes.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/invoices", () => {
  it("creates an intra-state invoice with a 50/50 CGST/SGST split and decrements stock", async () => {
    const customer = await prisma.customer.create({
      data: { outletId, customerCode: "T0001", name: "Intra Customer", stateCode: "27" },
    });

    const res = await createInvoice(customer.id, 2, 236000); // 2 x 1000rs @ 18% = 2360rs, paid in full
    expect(res.status).toBe(201);
    expect(res.body.isInterState).toBe(false);
    expect(res.body.taxableValue).toBe(200000);
    expect(res.body.cgstAmount).toBe(18000);
    expect(res.body.sgstAmount).toBe(18000);
    expect(res.body.igstAmount).toBe(0);
    expect(res.body.grandTotal).toBe(236000);
    expect(res.body.status).toBe("PAID");

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    expect(item?.currentStock).toBe(8); // 10 - 2
  });

  it("creates an inter-state invoice with the full tax going to IGST", async () => {
    const customer = await prisma.customer.create({
      data: { outletId, customerCode: "T0002", name: "Inter Customer", stateCode: "29" },
    });

    const res = await createInvoice(customer.id, 1, 0);
    expect(res.status).toBe(201);
    expect(res.body.isInterState).toBe(true);
    expect(res.body.cgstAmount).toBe(0);
    expect(res.body.sgstAmount).toBe(0);
    expect(res.body.igstAmount).toBe(18000);
    expect(res.body.status).toBe("UNPAID");
  });

  it("rejects an invoice when the requested quantity exceeds current stock", async () => {
    const customer = await prisma.customer.create({
      data: { outletId, customerCode: "T0003", name: "Overorder Customer", stateCode: "27" },
    });

    const res = await createInvoice(customer.id, 9999, 0);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);
  });
});

describe("GET /api/customers/:id/credit-status", () => {
  it("sums the unpaid balance across multiple invoices for the same customer", async () => {
    const customer = await prisma.customer.create({
      data: { outletId, customerCode: "T0004", name: "Credit Customer", stateCode: "27", creditLimit: 100000 },
    });

    const first = await createInvoice(customer.id, 1, 0); // 1180rs fully unpaid
    expect(first.status).toBe(201);
    const second = await createInvoice(customer.id, 1, 59000); // 1180rs, half paid -> 590rs outstanding

    const statusRes = await request(app)
      .get(`/api/customers/${customer.id}/credit-status`)
      .set("Authorization", `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.creditLimit).toBe(100000);
    expect(statusRes.body.currentOutstanding).toBe(first.body.grandTotal + (second.body.grandTotal - second.body.amountPaid));
  });

  it("returns null creditLimit and zero outstanding for a customer with no limit and no invoices", async () => {
    const customer = await prisma.customer.create({
      data: { outletId, customerCode: "T0005", name: "No Limit Customer", stateCode: "27" },
    });

    const statusRes = await request(app)
      .get(`/api/customers/${customer.id}/credit-status`)
      .set("Authorization", `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.creditLimit).toBeNull();
    expect(statusRes.body.currentOutstanding).toBe(0);
  });
});
