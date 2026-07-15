import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { deriveStateCode } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { generateCustomerCode } from "../lib/customerCode";
import { HttpError } from "../middleware/errorHandler";
import { parsePagination } from "../lib/pagination";
import { logAudit } from "../lib/auditLog";

export const customersRouter = Router();
customersRouter.use(requireAuth);

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

const customerInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  phone: z.string().min(1, "Phone is required"),
  alternateMobile: z.string().optional(),
  company: z.string().optional(),
  addressLine1: z.string().min(1, "Address Line 1 is required"),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  city: z.string().min(1, "City is required"),
  district: z.string().min(1, "District is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(PINCODE_REGEX, "Invalid pincode format (6 digits)"),
  panCode: z.string().regex(PAN_REGEX, "Invalid PAN format (e.g., ABCDE1234F)").optional().or(z.literal("")),
  gstin: z.string().regex(GST_REGEX, "Invalid GST format (e.g., 27ABCDE1234F1ZV)").optional().or(z.literal("")),
  creditLimit: z.number().int().nonnegative().nullable().optional(),
});

function withDerivedStateCode<T extends { state?: string; gstin?: string }>(data: T) {
  return { ...data, stateCode: deriveStateCode(data.state, data.gstin) };
}

function buildCustomerWhere(outletId: string, query: Record<string, unknown>) {
  const search = (query.search as string | undefined)?.trim();
  const from = query.from as string | undefined;
  const to = query.to as string | undefined;
  const status = query.status as string | undefined;

  return {
    outletId,
    active: status === "inactive" ? false : true,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { customerCode: { contains: search } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };
}

customersRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const where = buildCustomerWhere(outletId, req.query);
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data: customers, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/export", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const customers = await prisma.customer.findMany({
      where: buildCustomerWhere(outletId, req.query),
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Customers");
    sheet.columns = [
      { header: "Customer Code", key: "customerCode", width: 14 },
      { header: "Name", key: "name", width: 22 },
      { header: "Email", key: "email", width: 26 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Alternative Mobile", key: "alternateMobile", width: 18 },
      { header: "Company", key: "company", width: 20 },
      { header: "Address Line 1", key: "addressLine1", width: 24 },
      { header: "Address Line 2", key: "addressLine2", width: 20 },
      { header: "Address Line 3", key: "addressLine3", width: 20 },
      { header: "City", key: "city", width: 16 },
      { header: "District", key: "district", width: 16 },
      { header: "State", key: "state", width: 16 },
      { header: "Pincode", key: "pincode", width: 10 },
      { header: "PAN Code", key: "panCode", width: 14 },
      { header: "GST No.", key: "gstin", width: 18 },
      { header: "Created At", key: "createdAt", width: 14 },
    ];
    sheet.addRows(
      customers.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString().slice(0, 10),
      }))
    );
    sheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/by-code/:code", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const customer = await prisma.customer.findUnique({
      where: { outletId_customerCode: { outletId, customerCode: req.params.code } },
    });
    if (!customer) throw new HttpError(404, "Customer not found");
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, outletId },
    });
    if (!customer) throw new HttpError(404, "Customer not found");
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id/credit-status", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!customer) throw new HttpError(404, "Customer not found");

    const unpaidInvoices = await prisma.invoice.findMany({
      where: { customerId: customer.id, outletId, status: { not: "PAID" } },
      select: { grandTotal: true, amountPaid: true },
    });
    const currentOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.grandTotal - inv.amountPaid), 0);

    res.json({ creditLimit: customer.creditLimit, currentOutstanding });
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id/purchase-history", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const invoices = await prisma.invoice.findMany({
      where: { customerId: req.params.id, outletId },
      orderBy: { createdAt: "desc" },
      include: { lineItems: true, payments: true },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = withDerivedStateCode(customerInputSchema.parse(req.body));
    const customerCode = await generateCustomerCode(outletId);

    const customer = await prisma.customer.create({
      data: { ...data, outletId, customerCode },
    });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "CREATE",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Created customer "${customer.name}" (${customer.customerCode})`,
    });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

const customerAddressSchema = z.object({
  label: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(PINCODE_REGEX, "Invalid pincode format (6 digits)").optional().or(z.literal("")),
  gstin: z.string().regex(GST_REGEX, "Invalid GST format (e.g., 27ABCDE1234F1ZV)").optional().or(z.literal("")),
});

customersRouter.get("/:id/addresses", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!customer) throw new HttpError(404, "Customer not found");

    const addresses = await prisma.customerAddress.findMany({
      where: { customerId: req.params.id, outletId },
      orderBy: { createdAt: "asc" },
    });
    res.json(addresses);
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/:id/addresses", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = customerAddressSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!customer) throw new HttpError(404, "Customer not found");

    const address = await prisma.customerAddress.create({
      data: { ...data, outletId, customerId: req.params.id, stateCode: deriveStateCode(data.state, data.gstin) },
    });
    res.status(201).json(address);
  } catch (err) {
    next(err);
  }
});

customersRouter.put("/:id/addresses/:addressId", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = customerAddressSchema.partial().parse(req.body);

    const existing = await prisma.customerAddress.findFirst({
      where: { id: req.params.addressId, customerId: req.params.id, outletId },
    });
    if (!existing) throw new HttpError(404, "Address not found");

    const address = await prisma.customerAddress.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(data.state !== undefined || data.gstin !== undefined
          ? { stateCode: deriveStateCode(data.state ?? existing.state, data.gstin ?? existing.gstin) }
          : {}),
      },
    });
    res.json(address);
  } catch (err) {
    next(err);
  }
});

customersRouter.delete("/:id/addresses/:addressId", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.customerAddress.findFirst({
      where: { id: req.params.addressId, customerId: req.params.id, outletId },
    });
    if (!existing) throw new HttpError(404, "Address not found");

    await prisma.customerAddress.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const linkItemSchema = z.object({
  itemId: z.string().min(1),
  customPrice: z.number().int().nonnegative().nullable().optional(),
  isFavorite: z.boolean().optional(),
});

customersRouter.get("/:id/items", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!customer) throw new HttpError(404, "Customer not found");

    const links = await prisma.customerItem.findMany({
      where: { customerId: req.params.id, outletId },
      include: { item: true },
      orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
    });
    res.json(
      links.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        item: l.item,
        customPrice: l.customPrice,
        isFavorite: l.isFavorite,
      }))
    );
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/:id/items", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = linkItemSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!customer) throw new HttpError(404, "Customer not found");

    const item = await prisma.item.findFirst({ where: { id: data.itemId, outletId } });
    if (!item) throw new HttpError(404, "Item not found");

    const link = await prisma.customerItem.upsert({
      where: { customerId_itemId: { customerId: req.params.id, itemId: data.itemId } },
      create: {
        outletId,
        customerId: req.params.id,
        itemId: data.itemId,
        customPrice: data.customPrice ?? null,
        isFavorite: data.isFavorite ?? false,
      },
      update: {
        ...(data.customPrice !== undefined ? { customPrice: data.customPrice } : {}),
        ...(data.isFavorite !== undefined ? { isFavorite: data.isFavorite } : {}),
      },
      include: { item: true },
    });
    res.status(201).json({
      id: link.id,
      itemId: link.itemId,
      item: link.item,
      customPrice: link.customPrice,
      isFavorite: link.isFavorite,
    });
  } catch (err) {
    next(err);
  }
});

customersRouter.delete("/:id/items/:itemId", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const link = await prisma.customerItem.findFirst({
      where: { customerId: req.params.id, itemId: req.params.itemId, outletId },
    });
    if (!link) throw new HttpError(404, "Linked item not found");

    await prisma.customerItem.delete({ where: { id: link.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

customersRouter.put("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const partial = customerInputSchema.partial().parse(req.body);

    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Customer not found");

    const data =
      partial.state !== undefined || partial.gstin !== undefined
        ? {
            ...partial,
            stateCode: deriveStateCode(partial.state ?? existing.state, partial.gstin ?? existing.gstin),
          }
        : partial;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "UPDATE",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Updated customer "${customer.name}" (${customer.customerCode})`,
    });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

customersRouter.delete("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Customer not found");

    await prisma.customer.update({ where: { id: req.params.id }, data: { active: false } });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "DELETE",
      entityType: "Customer",
      entityId: existing.id,
      summary: `Deleted customer "${existing.name}" (${existing.customerCode})`,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/bulk-delete", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { ids } = bulkDeleteSchema.parse(req.body);

    const targets = await prisma.customer.findMany({ where: { id: { in: ids }, outletId }, select: { id: true, name: true } });
    const result = await prisma.customer.updateMany({
      where: { id: { in: ids }, outletId },
      data: { active: false },
    });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "BULK_DELETE",
      entityType: "Customer",
      entityId: targets.map((t) => t.id).join(","),
      summary: `Bulk-deleted ${result.count} customers: ${targets.map((t) => t.name).join(", ")}`,
    });
    res.json({ deleted: result.count });
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/:id/restore", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Customer not found");

    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: { active: true } });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "RESTORE",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Restored customer "${customer.name}" (${customer.customerCode})`,
    });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});
