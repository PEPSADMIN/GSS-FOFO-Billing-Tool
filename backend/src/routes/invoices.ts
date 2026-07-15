import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";
import { calculateLineTax, applyRoundOff, isInterState, paiseToRupees, PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@gss/shared";
import type { InstallmentStatus } from "@gss/shared";
import { getNextInvoiceNumber } from "../lib/invoiceNumber";
import { parsePagination } from "../lib/pagination";
import { generateInvoicePdf } from "../lib/invoicePdf";
import PDFDocument from "pdfkit";
import { logAudit } from "../lib/auditLog";
import { formatAddressSnapshot } from "../lib/addressSnapshot";

function installmentStatus(inst: { paidAt: Date | null; dueDate: Date }): InstallmentStatus {
  if (inst.paidAt) return "PAID";
  return inst.dueDate.getTime() < Date.now() ? "OVERDUE" : "PENDING";
}

function toInstallmentDTO(inst: {
  id: string;
  amount: number;
  dueDate: Date;
  paidAt: Date | null;
  interestRate?: number | null;
  documentCharges?: number | null;
}) {
  return {
    id: inst.id,
    amount: inst.amount,
    dueDate: inst.dueDate.toISOString(),
    paidAt: inst.paidAt?.toISOString() ?? null,
    status: installmentStatus(inst),
    interestRate: inst.interestRate ?? null,
    documentCharges: inst.documentCharges ?? null,
  };
}

function buildInvoiceWhere(outletId: string, query: Record<string, unknown>) {
  const { from, to, status } = query as { from?: string; to?: string; status?: string };
  return {
    outletId,
    ...(status ? { status } : {}),
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

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  lineItems: z
    .array(
      z.object({
        itemId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  payments: z
    .array(
      z.object({
        mode: z.enum(PAYMENT_MODES),
        amount: z.number().int().min(0),
      })
    )
    .default([]),
  billToAddressId: z.string().optional(),
  ewayBillNo: z.string().max(20).optional(),
  cinNumber: z.string().max(21).optional(),
  acknowledgeNo: z.string().max(30).optional(),
  transportMode: z.string().max(10).optional(),
  transporterName: z.string().max(100).optional(),
  vehicleRegNo: z.string().max(15).optional(),
  driverContactNo: z.string().max(15).optional(),
  poNo: z.string().max(50).optional(),
  lrNo: z.string().max(50).optional(),
  lrDate: z.string().max(20).optional(),
});

invoicesRouter.post("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const userId = req.user!.userId;
    const input = createInvoiceSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.findUnique({ where: { id: outletId } });
      if (!outlet) throw new HttpError(500, "Outlet not found");

      const customer = input.customerId
        ? await tx.customer.findFirst({ where: { id: input.customerId, outletId } })
        : null;
      if (input.customerId && !customer) throw new HttpError(404, "Customer not found");

      const itemIds = input.lineItems.map((li) => li.itemId);
      const items = await tx.item.findMany({ where: { id: { in: itemIds }, outletId } });
      const itemsById = new Map(items.map((i) => [i.id, i]));

      for (const li of input.lineItems) {
        const item = itemsById.get(li.itemId);
        if (!item) throw new HttpError(404, `Item ${li.itemId} not found`);
        if (item.currentStock < li.quantity) {
          throw new HttpError(400, `Insufficient stock for "${item.name}" (have ${item.currentStock}, need ${li.quantity})`);
        }
      }

      const interState = isInterState(outlet.stateCode, customer?.stateCode ?? null);

      let billToAddressId: string | null = null;
      let billToSnapshot: string | null = null;
      let shipToSnapshot: string | null = null;
      if (customer) {
        shipToSnapshot = formatAddressSnapshot(customer.name, customer);
        if (input.billToAddressId) {
          const billAddress = await tx.customerAddress.findFirst({
            where: { id: input.billToAddressId, customerId: customer.id, outletId },
          });
          if (!billAddress) throw new HttpError(404, "Bill-to address not found");
          billToAddressId = billAddress.id;
          billToSnapshot = formatAddressSnapshot(customer.name, billAddress);
        } else {
          billToSnapshot = shipToSnapshot;
        }
      }

      let taxableValueTotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      const lineItemsData = input.lineItems.map((li) => {
        const item = itemsById.get(li.itemId)!;
        const taxableValue = item.price * li.quantity;
        const tax = calculateLineTax(taxableValue, item.gstRate, interState);
        const lineTotal = taxableValue + tax.cgst + tax.sgst + tax.igst;

        taxableValueTotal += taxableValue;
        cgstTotal += tax.cgst;
        sgstTotal += tax.sgst;
        igstTotal += tax.igst;

        return {
          itemId: item.id,
          itemName: item.name,
          hsnCode: item.hsnCode,
          unit: item.unit,
          quantity: li.quantity,
          unitPrice: item.price,
          gstRate: item.gstRate,
          taxableValue,
          cgstAmount: tax.cgst,
          sgstAmount: tax.sgst,
          igstAmount: tax.igst,
          lineTotal,
        };
      });

      const preRoundTotal = taxableValueTotal + cgstTotal + sgstTotal + igstTotal;
      const { grandTotal, roundOff } = applyRoundOff(preRoundTotal);

      const amountPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);
      if (amountPaid > grandTotal) {
        throw new HttpError(400, `Amount paid (${amountPaid} paise) exceeds the invoice total (${grandTotal} paise)`);
      }
      const status = amountPaid >= grandTotal ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";

      const { sequenceNo, financialYear, invoiceNumber } = await getNextInvoiceNumber(tx, outletId);

      const invoice = await tx.invoice.create({
        data: {
          outletId,
          invoiceNumber,
          sequenceNo,
          financialYear,
          customerId: customer?.id,
          createdByUserId: userId,
          isInterState: interState,
          taxableValue: taxableValueTotal,
          cgstAmount: cgstTotal,
          sgstAmount: sgstTotal,
          igstAmount: igstTotal,
          roundOff,
          grandTotal,
          status,
          amountPaid,
          billToAddressId,
          billToSnapshot,
          shipToSnapshot,
          ewayBillNo: input.ewayBillNo ?? null,
          cinNumber: input.cinNumber ?? null,
          acknowledgeNo: input.acknowledgeNo ?? null,
          transportMode: input.transportMode ?? null,
          transporterName: input.transporterName ?? null,
          vehicleRegNo: input.vehicleRegNo ?? null,
          driverContactNo: input.driverContactNo ?? null,
          poNo: input.poNo ?? null,
          lrNo: input.lrNo ?? null,
          lrDate: input.lrDate ?? null,
          lineItems: { create: lineItemsData },
          payments: { create: input.payments },
        },
        include: { lineItems: true, payments: true, customer: true, installments: true },
      });

      for (const li of input.lineItems) {
        const item = itemsById.get(li.itemId)!;
        const resultingStock = item.currentStock - li.quantity;
        await tx.item.update({ where: { id: item.id }, data: { currentStock: resultingStock } });
        await tx.stockMovement.create({
          data: {
            outletId,
            itemId: item.id,
            type: "SALE_OUT",
            quantity: li.quantity,
            resultingStock,
            referenceInvoiceId: invoice.id,
          },
        });
      }

      return invoice;
    });

    logAudit({
      outletId,
      userId,
      userName: req.user!.name,
      action: "CREATE",
      entityType: "Invoice",
      entityId: result.id,
      summary: `Created invoice ${result.invoiceNumber} for ${result.customer?.name ?? "a walk-in customer"} (${(result.grandTotal / 100).toFixed(2)})`,
    });

    res.status(201).json({ ...result, installments: result.installments.map(toInstallmentDTO) });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const where = buildInvoiceWhere(outletId, req.query);
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: { customer: true, payments: true }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ data: invoices, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/export", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere(outletId, req.query),
      include: { customer: true, payments: true },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Invoices");
    sheet.columns = [
      { header: "Invoice Number", key: "invoiceNumber", width: 22 },
      { header: "Date", key: "date", width: 14 },
      { header: "Customer", key: "customer", width: 22 },
      { header: "Taxable Value (₹)", key: "taxableValue", width: 18 },
      { header: "CGST (₹)", key: "cgst", width: 12 },
      { header: "SGST (₹)", key: "sgst", width: 12 },
      { header: "IGST (₹)", key: "igst", width: 12 },
      { header: "Grand Total (₹)", key: "grandTotal", width: 16 },
      { header: "Status", key: "status", width: 12 },
      { header: "Amount Paid (₹)", key: "amountPaid", width: 16 },
      { header: "Payment Modes", key: "paymentModes", width: 26 },
    ];
    sheet.addRows(
      invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        date: inv.createdAt.toISOString().slice(0, 10),
        customer: inv.customer?.name ?? "Walk-in",
        taxableValue: paiseToRupees(inv.taxableValue),
        cgst: paiseToRupees(inv.cgstAmount),
        sgst: paiseToRupees(inv.sgstAmount),
        igst: paiseToRupees(inv.igstAmount),
        grandTotal: paiseToRupees(inv.grandTotal),
        status: inv.status,
        amountPaid: paiseToRupees(inv.amountPaid),
        paymentModes: inv.payments
          .map((p) => `${PAYMENT_MODE_LABELS[p.mode as keyof typeof PAYMENT_MODE_LABELS]}: ${paiseToRupees(p.amount)}`)
          .join(", "),
      }))
    );
    sheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/due-installments", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const withinDays = Number(req.query.withinDays ?? 1);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    cutoff.setHours(23, 59, 59, 999);

    const installments = await prisma.installment.findMany({
      where: { outletId, paidAt: null, dueDate: { lte: cutoff } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { dueDate: "asc" },
    });

    res.json(
      installments.map((inst) => ({
        id: inst.id,
        amount: inst.amount,
        dueDate: inst.dueDate.toISOString(),
        status: installmentStatus(inst),
        invoiceId: inst.invoiceId,
        invoiceNumber: inst.invoice.invoiceNumber,
        customerName: inst.invoice.customer?.name ?? "Walk-in customer",
        customerPhone: inst.invoice.customer?.phone ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, outletId },
      include: { lineItems: true, payments: true, customer: true, installments: { orderBy: { dueDate: "asc" } } },
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    res.json({ ...invoice, installments: invoice.installments.map(toInstallmentDTO) });
  } catch (err) {
    next(err);
  }
});

const updateDocsSchema = z.object({
  ewayBillNo: z.string().max(20).optional(),
  cinNumber: z.string().max(21).optional(),
  acknowledgeNo: z.string().max(30).optional(),
  transportMode: z.string().max(10).optional(),
  transporterName: z.string().max(100).optional(),
  vehicleRegNo: z.string().max(15).optional(),
  driverContactNo: z.string().max(15).optional(),
  poNo: z.string().max(50).optional(),
  lrNo: z.string().max(50).optional(),
  lrDate: z.string().max(20).optional(),
});

function nullableField(val: string | undefined): string | null | undefined {
  if (val === undefined) return undefined;
  return val.trim() || null;
}

invoicesRouter.patch("/:id/docs", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = updateDocsSchema.parse(req.body);
    const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Invoice not found");
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        ...(data.ewayBillNo !== undefined ? { ewayBillNo: nullableField(data.ewayBillNo) } : {}),
        ...(data.cinNumber !== undefined ? { cinNumber: nullableField(data.cinNumber) } : {}),
        ...(data.acknowledgeNo !== undefined ? { acknowledgeNo: nullableField(data.acknowledgeNo) } : {}),
        ...(data.transportMode !== undefined ? { transportMode: nullableField(data.transportMode) } : {}),
        ...(data.transporterName !== undefined ? { transporterName: nullableField(data.transporterName) } : {}),
        ...(data.vehicleRegNo !== undefined ? { vehicleRegNo: nullableField(data.vehicleRegNo) } : {}),
        ...(data.driverContactNo !== undefined ? { driverContactNo: nullableField(data.driverContactNo) } : {}),
        ...(data.poNo !== undefined ? { poNo: nullableField(data.poNo) } : {}),
        ...(data.lrNo !== undefined ? { lrNo: nullableField(data.lrNo) } : {}),
        ...(data.lrDate !== undefined ? { lrDate: nullableField(data.lrDate) } : {}),
      },
      include: { lineItems: true, payments: true, customer: true, installments: { orderBy: { dueDate: "asc" } } },
    });
    res.json({ ...invoice, installments: invoice.installments.map(toInstallmentDTO) });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id/pdf", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, outletId },
      include: { lineItems: true, customer: true, outlet: true, dispatch: true },
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");

    const customerName = invoice.customer?.name ?? "Walk-in customer";
    const shipToText = invoice.shipToSnapshot ?? (invoice.customer ? formatAddressSnapshot(customerName, invoice.customer) : customerName);
    const billToText = invoice.billToSnapshot ?? shipToText;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber.replace(/\//g, "-")}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);
    generateInvoicePdf(doc, {
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      isInterState: invoice.isInterState,
      taxableValue: invoice.taxableValue,
      cgstAmount: invoice.cgstAmount,
      sgstAmount: invoice.sgstAmount,
      igstAmount: invoice.igstAmount,
      roundOff: invoice.roundOff,
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.amountPaid,
      status: invoice.status,
      outlet: invoice.outlet,
      billToText,
      shipToText,
      lineItems: invoice.lineItems,
      ewayBillNo: invoice.ewayBillNo,
      acknowledgeNo: invoice.acknowledgeNo,
      transportMode: invoice.transportMode,
      transporterName: invoice.transporterName,
      vehicleRegNo: invoice.vehicleRegNo,
      driverContactNo: invoice.driverContactNo,
      poNo: invoice.poNo,
      lrNo: invoice.lrNo,
      lrDate: invoice.lrDate,
      buyerGstin: invoice.customer?.gstin,
    });
    doc.end();
  } catch (err) {
    next(err);
  }
});

const addPaymentSchema = z.object({
  mode: z.enum(PAYMENT_MODES),
  amount: z.number().int().positive(),
});

invoicesRouter.post("/:id/payments", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const input = addPaymentSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: req.params.id, outletId }, include: { payments: true } });
      if (!invoice) throw new HttpError(404, "Invoice not found");
      if (invoice.status === "PAID") throw new HttpError(400, "This invoice is already fully paid");

      const remaining = invoice.grandTotal - invoice.amountPaid;
      if (input.amount > remaining) {
        throw new HttpError(400, `Amount exceeds the remaining balance of ${remaining} paise`);
      }

      await tx.payment.create({
        data: { invoiceId: invoice.id, mode: input.mode, amount: input.amount, isInitial: false },
      });

      const amountPaid = invoice.amountPaid + input.amount;
      const status = amountPaid >= invoice.grandTotal ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";

      return tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid, status },
        include: { lineItems: true, payments: true, customer: true, installments: { orderBy: { dueDate: "asc" } } },
      });
    });

    res.json({ ...result, installments: result.installments.map(toInstallmentDTO) });
  } catch (err) {
    next(err);
  }
});

const setInstallmentPlanSchema = z.object({
  count: z.number().int().min(1).max(36),
  startDate: z.string().min(1),
  intervalDays: z.number().int().min(1).max(90),
  interestRate: z.number().min(0).max(100).optional(),
  documentCharges: z.number().int().min(0).optional(),
});

invoicesRouter.post("/:id/installments", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const input = setInstallmentPlanSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: req.params.id, outletId } });
      if (!invoice) throw new HttpError(404, "Invoice not found");

      const remaining = invoice.grandTotal - invoice.amountPaid;
      if (remaining <= 0) throw new HttpError(400, "This invoice is already fully paid");

      const interestRate = input.interestRate ?? 0;
      const documentCharges = input.documentCharges ?? 0;
      const interestAmount = Math.round((remaining * interestRate) / 100);
      const totalPayable = remaining + interestAmount + documentCharges;

      // Re-planning: drop any not-yet-paid installments and regenerate against the current remaining balance.
      await tx.installment.deleteMany({ where: { invoiceId: invoice.id, paidAt: null } });

      const base = Math.floor(totalPayable / input.count);
      const rows = Array.from({ length: input.count }, (_, i) => {
        const dueDate = new Date(`${input.startDate}T00:00:00`);
        dueDate.setDate(dueDate.getDate() + i * input.intervalDays);
        const amount = i === input.count - 1 ? totalPayable - base * (input.count - 1) : base;
        return {
          outletId,
          invoiceId: invoice.id,
          amount,
          dueDate,
          interestRate: input.interestRate ?? null,
          documentCharges: input.documentCharges ?? null,
        };
      });
      await tx.installment.createMany({ data: rows });

      return tx.installment.findMany({ where: { invoiceId: invoice.id }, orderBy: { dueDate: "asc" } });
    });

    res.status(201).json(result.map(toInstallmentDTO));
  } catch (err) {
    next(err);
  }
});

invoicesRouter.delete("/:id/installments", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, outletId } });
    if (!invoice) throw new HttpError(404, "Invoice not found");

    await prisma.installment.deleteMany({ where: { invoiceId: invoice.id, paidAt: null } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const payInstallmentSchema = z.object({
  mode: z.enum(PAYMENT_MODES),
});

invoicesRouter.post("/:id/installments/:installmentId/pay", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const input = payInstallmentSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: req.params.id, outletId } });
      if (!invoice) throw new HttpError(404, "Invoice not found");

      const installment = await tx.installment.findFirst({
        where: { id: req.params.installmentId, invoiceId: invoice.id, outletId },
      });
      if (!installment) throw new HttpError(404, "Installment not found");
      if (installment.paidAt) throw new HttpError(400, "This installment is already paid");

      const remaining = invoice.grandTotal - invoice.amountPaid;
      if (installment.amount > remaining) {
        throw new HttpError(400, "This installment no longer matches the invoice's remaining balance — kindly re-plan it");
      }

      const payment = await tx.payment.create({
        data: { invoiceId: invoice.id, mode: input.mode, amount: installment.amount, isInitial: false },
      });
      await tx.installment.update({
        where: { id: installment.id },
        data: { paidAt: new Date(), paymentId: payment.id },
      });

      const amountPaid = invoice.amountPaid + installment.amount;
      const status = amountPaid >= invoice.grandTotal ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";

      return tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid, status },
        include: { lineItems: true, payments: true, customer: true, installments: { orderBy: { dueDate: "asc" } } },
      });
    });

    res.json({ ...result, installments: result.installments.map(toInstallmentDTO) });
  } catch (err) {
    next(err);
  }
});
