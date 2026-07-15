import { Router, Response } from "express";
import ExcelJS from "exceljs";
import { paiseToRupees, PaymentMode, PAYMENT_MODE_LABELS } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

async function sendWorkbook(res: Response, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

async function computeDailySummary(outletId: string, dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);

  const invoices = await prisma.invoice.findMany({
    where: { outletId, createdAt: { gte: start, lte: end } },
    include: { payments: true },
  });

  const byMode: Partial<Record<PaymentMode, number>> = {};
  for (const inv of invoices) {
    for (const p of inv.payments) {
      const mode = p.mode as PaymentMode;
      byMode[mode] = (byMode[mode] ?? 0) + p.amount;
    }
  }

  return {
    date: dateStr,
    invoiceCount: invoices.length,
    totalSales: invoices.reduce((sum, inv) => sum + inv.grandTotal, 0),
    totalTax: invoices.reduce((sum, inv) => sum + inv.cgstAmount + inv.sgstAmount + inv.igstAmount, 0),
    byMode,
  };
}

async function computeGstSummary(outletId: string, from?: string, to?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      outletId,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    },
    include: { lineItems: true },
  });

  const byRateMap = new Map<number, { gstRate: number; taxableValue: number; cgst: number; sgst: number; igst: number }>();
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let grandTotal = 0;

  for (const inv of invoices) {
    taxableValue += inv.taxableValue;
    cgst += inv.cgstAmount;
    sgst += inv.sgstAmount;
    igst += inv.igstAmount;
    grandTotal += inv.grandTotal;

    for (const li of inv.lineItems) {
      const bucket = byRateMap.get(li.gstRate) ?? { gstRate: li.gstRate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
      bucket.taxableValue += li.taxableValue;
      bucket.cgst += li.cgstAmount;
      bucket.sgst += li.sgstAmount;
      bucket.igst += li.igstAmount;
      byRateMap.set(li.gstRate, bucket);
    }
  }

  return {
    taxableValue,
    cgst,
    sgst,
    igst,
    grandTotal,
    byRate: Array.from(byRateMap.values()).sort((a, b) => a.gstRate - b.gstRate),
  };
}

const AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;

function agingBucketFor(days: number): (typeof AGING_BUCKETS)[number] {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

async function computeOutstandingSummary(outletId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { outletId, status: { not: "PAID" } },
    include: { customer: true },
  });

  const now = Date.now();
  const aging = new Map(AGING_BUCKETS.map((b) => [b, { amount: 0, count: 0 }]));
  const byCustomer = new Map<string, { customerId: string; name: string; phone: string | null; outstanding: number; oldestDueDays: number }>();
  let totalOutstanding = 0;

  for (const inv of invoices) {
    const balance = inv.grandTotal - inv.amountPaid;
    if (balance <= 0) continue;
    const ageDays = Math.floor((now - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const bucket = agingBucketFor(ageDays);
    const bucketEntry = aging.get(bucket)!;
    bucketEntry.amount += balance;
    bucketEntry.count += 1;
    totalOutstanding += balance;

    if (inv.customerId) {
      const existing = byCustomer.get(inv.customerId);
      if (existing) {
        existing.outstanding += balance;
        existing.oldestDueDays = Math.max(existing.oldestDueDays, ageDays);
      } else {
        byCustomer.set(inv.customerId, {
          customerId: inv.customerId,
          name: inv.customer?.name ?? "Unknown",
          phone: inv.customer?.phone ?? null,
          outstanding: balance,
          oldestDueDays: ageDays,
        });
      }
    }
  }

  return {
    totalOutstanding,
    aging: AGING_BUCKETS.map((bucket) => ({ bucket, ...aging.get(bucket)! })),
    customers: Array.from(byCustomer.values()).sort((a, b) => b.outstanding - a.outstanding),
  };
}

reportsRouter.get("/outstanding", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    res.json(await computeOutstandingSummary(outletId));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/daily-summary", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    res.json(await computeDailySummary(outletId, dateStr));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/daily-summary/export", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const summary = await computeDailySummary(outletId, dateStr);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Daily Summary");
    sheet.columns = [
      { header: "Metric", key: "metric", width: 24 },
      { header: "Value", key: "value", width: 18 },
    ];
    sheet.addRows([
      { metric: "Date", value: summary.date },
      { metric: "Invoice count", value: summary.invoiceCount },
      { metric: "Total sales (₹)", value: paiseToRupees(summary.totalSales) },
      { metric: "Total tax (₹)", value: paiseToRupees(summary.totalTax) },
      ...Object.entries(summary.byMode).map(([mode, amount]) => ({
        metric: `${PAYMENT_MODE_LABELS[mode as PaymentMode]} (₹)`,
        value: paiseToRupees(amount ?? 0),
      })),
    ]);
    sheet.getRow(1).font = { bold: true };

    await sendWorkbook(res, workbook, `daily-summary-${summary.date}.xlsx`);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/gst-summary", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { from, to } = req.query as { from?: string; to?: string };
    res.json(await computeGstSummary(outletId, from, to));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/gst-summary/export", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { from, to } = req.query as { from?: string; to?: string };
    const gst = await computeGstSummary(outletId, from, to);

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet("GST Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 24 },
      { header: "Value (₹)", key: "value", width: 18 },
    ];
    summarySheet.addRows([
      { metric: "Period from", value: from ?? "All time" },
      { metric: "Period to", value: to ?? "All time" },
      { metric: "Taxable value", value: paiseToRupees(gst.taxableValue) },
      { metric: "CGST", value: paiseToRupees(gst.cgst) },
      { metric: "SGST", value: paiseToRupees(gst.sgst) },
      { metric: "IGST", value: paiseToRupees(gst.igst) },
      { metric: "Grand total", value: paiseToRupees(gst.grandTotal) },
    ]);
    summarySheet.getRow(1).font = { bold: true };

    const byRateSheet = workbook.addWorksheet("By GST Rate");
    byRateSheet.columns = [
      { header: "GST Rate (%)", key: "gstRate", width: 14 },
      { header: "Taxable Value (₹)", key: "taxableValue", width: 18 },
      { header: "CGST (₹)", key: "cgst", width: 14 },
      { header: "SGST (₹)", key: "sgst", width: 14 },
      { header: "IGST (₹)", key: "igst", width: 14 },
    ];
    byRateSheet.addRows(
      gst.byRate.map((r) => ({
        gstRate: r.gstRate,
        taxableValue: paiseToRupees(r.taxableValue),
        cgst: paiseToRupees(r.cgst),
        sgst: paiseToRupees(r.sgst),
        igst: paiseToRupees(r.igst),
      }))
    );
    byRateSheet.getRow(1).font = { bold: true };

    const suffix = from || to ? `${from ?? "start"}_to_${to ?? "now"}` : "all-time";
    await sendWorkbook(res, workbook, `gst-summary-${suffix}.xlsx`);
  } catch (err) {
    next(err);
  }
});
