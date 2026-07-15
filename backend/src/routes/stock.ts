import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

export const stockRouter = Router();
stockRouter.use(requireAuth);

const INCREASE_TYPES = new Set(["ADJUSTMENT_IN", "PURCHASE_IN", "RETURN_IN", "OPENING_STOCK"]);

stockRouter.get("/ledger", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { itemId, from, to } = req.query as { itemId?: string; from?: string; to?: string };

    const movements = await prisma.stockMovement.findMany({
      where: {
        outletId,
        ...(itemId ? { itemId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
              },
            }
          : {}),
      },
      include: { item: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      movements.map((m) => ({
        id: m.id,
        itemId: m.itemId,
        itemName: m.item.name,
        type: m.type,
        in: INCREASE_TYPES.has(m.type) ? m.quantity : 0,
        out: INCREASE_TYPES.has(m.type) ? 0 : m.quantity,
        balance: m.resultingStock,
        note: m.note,
        referenceInvoiceId: m.referenceInvoiceId,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    next(err);
  }
});
