import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { rupeesToPaise } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";
import { parsePagination } from "../lib/pagination";
import { logAudit } from "../lib/auditLog";

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const itemInputSchema = z.object({
  name: z.string().min(1),
  hsnCode: z.string().min(1),
  unit: z.string().min(1),
  gstRate: z.number().min(0).max(28),
  price: z.number().int().min(0),
  currentStock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

const stockAdjustmentSchema = z.object({
  type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "PURCHASE_IN", "RETURN_IN", "OPENING_STOCK", "DAMAGE_OUT", "SAMPLE_OUT"]),
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

const ITEM_TEMPLATE_COLUMNS = ["Name", "HSN Code", "Unit", "GST Rate (%)", "Price (Rs)", "Current Stock", "Low Stock Threshold"];
const MAX_BULK_UPLOAD_ROWS = 2000;

const bulkUploadSchema = z.object({
  fileBase64: z.string().min(1, "No file provided"),
});

itemsRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const search = (req.query.search as string | undefined)?.trim();
    const lowStockOnly = req.query.lowStock === "true";
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const status = req.query.status as string | undefined;
    const where = {
      outletId,
      active: status === "inactive" ? false : true,
      ...(search ? { name: { contains: search } } : {}),
    };

    if (lowStockOnly) {
      // currentStock <= lowStockThreshold compares two columns on the same row, which Prisma's
      // basic `where` can't express — fetch the (search-narrowed) candidates and filter in JS.
      const items = await prisma.item.findMany({ where, orderBy: { name: "asc" } });
      const filtered = items.filter((i) => i.currentStock <= i.lowStockThreshold);
      res.json({ data: filtered.slice(skip, skip + take), total: filtered.length, page, pageSize });
      return;
    }

    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, orderBy: { name: "asc" }, skip, take }),
      prisma.item.count({ where }),
    ]);
    res.json({ data: items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

// Must be registered before GET /:id, which would otherwise swallow "/template" as an id.
itemsRouter.get("/template", async (_req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Items");
    sheet.columns = ITEM_TEMPLATE_COLUMNS.map((header) => ({ header, width: 20 }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(["100D-Rebonded Foam Sample", "9404", "PCS", 18, 1000, 50, 5]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="items-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

itemsRouter.get("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const item = await prisma.item.findFirst({ where: { id: req.params.id, outletId } });
    if (!item) throw new HttpError(404, "Item not found");
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = itemInputSchema.parse(req.body);
    const item = await prisma.item.create({ data: { ...data, outletId } });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "CREATE",
      entityType: "Item",
      entityId: item.id,
      summary: `Created item "${item.name}"`,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.put("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = itemInputSchema.partial().parse(req.body);

    const existing = await prisma.item.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Item not found");

    const item = await prisma.item.update({ where: { id: req.params.id }, data });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "UPDATE",
      entityType: "Item",
      entityId: item.id,
      summary: `Updated item "${item.name}"`,
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.item.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Item not found");

    await prisma.item.update({ where: { id: req.params.id }, data: { active: false } });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "DELETE",
      entityType: "Item",
      entityId: existing.id,
      summary: `Deleted item "${existing.name}"`,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/bulk-delete", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { ids } = bulkDeleteSchema.parse(req.body);

    const targets = await prisma.item.findMany({ where: { id: { in: ids }, outletId }, select: { id: true, name: true } });
    const result = await prisma.item.updateMany({
      where: { id: { in: ids }, outletId },
      data: { active: false },
    });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "BULK_DELETE",
      entityType: "Item",
      entityId: targets.map((t) => t.id).join(","),
      summary: `Bulk-deleted ${result.count} items: ${targets.map((t) => t.name).join(", ")}`,
    });
    res.json({ deleted: result.count });
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/bulk-upload", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { fileBase64 } = bulkUploadSchema.parse(req.body);
    const commaIdx = fileBase64.indexOf(",");
    const buffer = Buffer.from(commaIdx >= 0 ? fileBase64.slice(commaIdx + 1) : fileBase64, "base64");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new HttpError(400, "The uploaded file has no worksheet");

    const rowCount = sheet.actualRowCount - 1;
    if (rowCount > MAX_BULK_UPLOAD_ROWS) {
      throw new HttpError(400, `Too many rows (${rowCount}). Maximum ${MAX_BULK_UPLOAD_ROWS} items per upload.`);
    }

    const errors: { row: number; message: string }[] = [];
    const toCreate: z.infer<typeof itemInputSchema>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const values = row.values as (string | number | undefined)[]; // 1-indexed, [0] unused
      const [, name, hsnCode, unit, gstRate, priceRupees, currentStock, lowStockThreshold] = values;
      if (name === undefined && hsnCode === undefined && priceRupees === undefined) return; // blank row

      const candidate = {
        name: name !== undefined ? String(name).trim() : "",
        hsnCode: hsnCode !== undefined ? String(hsnCode).trim() : "",
        unit: unit !== undefined ? String(unit).trim() : "",
        gstRate: Number(gstRate),
        price: Number.isFinite(Number(priceRupees)) ? rupeesToPaise(Number(priceRupees)) : NaN,
        currentStock: currentStock !== undefined && currentStock !== "" ? Math.trunc(Number(currentStock)) : undefined,
        lowStockThreshold: lowStockThreshold !== undefined && lowStockThreshold !== "" ? Math.trunc(Number(lowStockThreshold)) : undefined,
      };

      const parsed = itemInputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({ row: rowNumber, message: parsed.error.errors.map((e) => e.message).join("; ") });
        return;
      }
      toCreate.push(parsed.data);
    });

    let created = 0;
    if (toCreate.length > 0) {
      const result = await prisma.item.createMany({ data: toCreate.map((data) => ({ ...data, outletId })) });
      created = result.count;
    }

    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "CREATE",
      entityType: "Item",
      entityId: "bulk-upload",
      summary: `Bulk-uploaded ${created} items (${errors.length} row(s) skipped)`,
    });

    res.json({ created, skipped: errors.length, errors });
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/:id/restore", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.item.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Item not found");

    const item = await prisma.item.update({ where: { id: req.params.id }, data: { active: true } });
    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "RESTORE",
      entityType: "Item",
      entityId: item.id,
      summary: `Restored item "${item.name}"`,
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.post("/:id/stock-adjustment", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { type, quantity, note } = stockAdjustmentSchema.parse(req.body);

    const item = await prisma.item.findFirst({ where: { id: req.params.id, outletId } });
    if (!item) throw new HttpError(404, "Item not found");

    const isIncrease = type === "ADJUSTMENT_IN" || type === "PURCHASE_IN" || type === "RETURN_IN" || type === "OPENING_STOCK";
    const delta = isIncrease ? quantity : -quantity;
    const resultingStock = item.currentStock + delta;
    if (resultingStock < 0) throw new HttpError(400, "Stock adjustment would result in negative stock");

    const [updatedItem] = await prisma.$transaction([
      prisma.item.update({ where: { id: item.id }, data: { currentStock: resultingStock } }),
      prisma.stockMovement.create({
        data: {
          outletId,
          itemId: item.id,
          type,
          quantity,
          resultingStock,
          note,
        },
      }),
    ]);

    res.json(updatedItem);
  } catch (err) {
    next(err);
  }
});
