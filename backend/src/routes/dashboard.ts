import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const now = new Date();
    const { from, to } = req.query as { from?: string; to?: string };
    const rangeFilter = from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } } : {};

    const todayStart = new Date(`${dateKey(now)}T00:00:00`);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const trendStart = new Date(now);
    trendStart.setDate(trendStart.getDate() - 13);
    trendStart.setHours(0, 0, 0, 0);
    const monthlyTrendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      todayInvoices,
      monthlyInvoices,
      unpaidInvoices,
      totalCustomers,
      items,
      trendInvoices,
      topCustomersRaw,
      topItemsRaw,
      monthlyTrendInvoices,
      statusCountsRaw,
      totalInvoices,
      recentInvoicesRaw,
    ] = await Promise.all([
      prisma.invoice.findMany({ where: { outletId, createdAt: { gte: todayStart } }, select: { grandTotal: true } }),
      prisma.invoice.findMany({ where: { outletId, createdAt: { gte: monthStart } }, select: { grandTotal: true } }),
      prisma.invoice.findMany({
        where: { outletId, status: { not: "PAID" } },
        select: { grandTotal: true, amountPaid: true },
      }),
      prisma.customer.count({ where: { outletId, active: true } }),
      prisma.item.findMany({ where: { outletId, active: true }, select: { currentStock: true, lowStockThreshold: true } }),
      prisma.invoice.findMany({
        where: { outletId, createdAt: { gte: trendStart } },
        select: { createdAt: true, grandTotal: true },
      }),
      prisma.invoice.groupBy({
        by: ["customerId"],
        where: { outletId, customerId: { not: null }, ...rangeFilter },
        _sum: { grandTotal: true },
        orderBy: { _sum: { grandTotal: "desc" } },
        take: 10,
      }),
      prisma.invoiceLineItem.groupBy({
        by: ["itemId"],
        where: { invoice: { outletId, ...rangeFilter } },
        _sum: { lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: { outletId, createdAt: { gte: monthlyTrendStart } },
        select: { createdAt: true, grandTotal: true },
      }),
      prisma.invoice.groupBy({ by: ["status"], where: { outletId, ...rangeFilter }, _count: { _all: true }, _sum: { grandTotal: true } }),
      prisma.invoice.count({ where: { outletId, ...rangeFilter } }),
      prisma.invoice.findMany({
        where: { outletId, ...rangeFilter },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: from || to ? 20 : 5,
      }),
    ]);

    const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const outstandingAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.grandTotal - inv.amountPaid), 0);
    const totalItems = items.length;
    const lowStockItems = items.filter((i) => i.currentStock <= i.lowStockThreshold).length;

    const trendByDate = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      trendByDate.set(dateKey(d), 0);
    }
    for (const inv of trendInvoices) {
      const key = dateKey(inv.createdAt);
      trendByDate.set(key, (trendByDate.get(key) ?? 0) + inv.grandTotal);
    }
    const salesTrend = Array.from(trendByDate.entries()).map(([date, sales]) => ({ date, sales }));

    const customerIds = topCustomersRaw.map((c) => c.customerId).filter((id): id is string => !!id);
    const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } });
    const customerNameById = new Map(customers.map((c) => [c.id, c.name]));
    const topCustomers = topCustomersRaw
      .filter((c) => c.customerId)
      .map((c) => ({
        customerId: c.customerId as string,
        name: customerNameById.get(c.customerId as string) ?? "Unknown",
        total: c._sum.grandTotal ?? 0,
      }));

    const itemIds = topItemsRaw.map((i) => i.itemId);
    const itemRows = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } });
    const itemNameById = new Map(itemRows.map((i) => [i.id, i.name]));
    const topItems = topItemsRaw.map((i) => ({
      itemId: i.itemId,
      name: itemNameById.get(i.itemId) ?? "Unknown",
      total: i._sum.lineTotal ?? 0,
    }));

    const monthlyTrendByMonth = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(monthlyTrendStart.getFullYear(), monthlyTrendStart.getMonth() + i, 1);
      monthlyTrendByMonth.set(monthKey(d), 0);
    }
    for (const inv of monthlyTrendInvoices) {
      const key = monthKey(inv.createdAt);
      if (monthlyTrendByMonth.has(key)) {
        monthlyTrendByMonth.set(key, (monthlyTrendByMonth.get(key) ?? 0) + inv.grandTotal);
      }
    }
    const monthlyTrend = Array.from(monthlyTrendByMonth.entries()).map(([key, sales]) => {
      const [, monthStr] = key.split("-");
      return { month: MONTH_LABELS[Number(monthStr) - 1], sales };
    });

    const statusCounts = statusCountsRaw.map((s) => ({
      status: s.status as "PAID" | "PARTIAL" | "UNPAID",
      count: s._count._all,
      amount: s._sum.grandTotal ?? 0,
    }));

    const recentInvoices = recentInvoicesRaw.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer?.name ?? "Walk-in customer",
      grandTotal: inv.grandTotal,
      status: inv.status as "PAID" | "PARTIAL" | "UNPAID",
      createdAt: inv.createdAt.toISOString(),
    }));

    res.json({
      todaySales,
      monthlySales,
      outstandingAmount,
      totalCustomers,
      totalItems,
      lowStockItems,
      totalInvoices,
      salesTrend,
      monthlyTrend,
      statusCounts,
      topCustomers,
      topItems,
      recentInvoices,
    });
  } catch (err) {
    next(err);
  }
});
