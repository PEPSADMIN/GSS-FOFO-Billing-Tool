import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireOwner } from "../middleware/auth";
import { parsePagination } from "../lib/pagination";

export const auditLogRouter = Router();
auditLogRouter.use(requireAuth, requireOwner);

auditLogRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { entityType } = req.query as { entityType?: string };
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const where = { outletId, ...(entityType ? { entityType } : {}) };
    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});
