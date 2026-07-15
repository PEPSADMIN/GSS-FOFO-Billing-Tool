import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

export const dispatchRouter = Router();
dispatchRouter.use(requireAuth);

function toDispatchDTO(d: {
  id: string;
  invoiceId: string;
  vehicleNo: string | null;
  lrNo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  status: string;
  dispatchedAt: Date | null;
  podReceivedAt: Date | null;
  podNote: string | null;
  createdAt: Date;
  invoice: { invoiceNumber: string; customer: { name: string } | null };
}) {
  return {
    id: d.id,
    invoiceId: d.invoiceId,
    invoiceNumber: d.invoice.invoiceNumber,
    customerName: d.invoice.customer?.name ?? "Walk-in customer",
    vehicleNo: d.vehicleNo,
    lrNo: d.lrNo,
    driverName: d.driverName,
    driverPhone: d.driverPhone,
    status: d.status,
    dispatchedAt: d.dispatchedAt?.toISOString() ?? null,
    podReceivedAt: d.podReceivedAt?.toISOString() ?? null,
    podNote: d.podNote,
    createdAt: d.createdAt.toISOString(),
  };
}

dispatchRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { status, from, to } = req.query as { status?: string; from?: string; to?: string };

    const dispatches = await prisma.dispatch.findMany({
      where: {
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
      },
      include: { invoice: { include: { customer: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(dispatches.map(toDispatchDTO));
  } catch (err) {
    next(err);
  }
});

dispatchRouter.get("/by-invoice/:invoiceId", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const dispatch = await prisma.dispatch.findFirst({
      where: { invoiceId: req.params.invoiceId, outletId },
      include: { invoice: { include: { customer: true } } },
    });
    if (!dispatch) throw new HttpError(404, "No dispatch record for this invoice");
    res.json(toDispatchDTO(dispatch));
  } catch (err) {
    next(err);
  }
});

const upsertDispatchSchema = z.object({
  vehicleNo: z.string().optional(),
  lrNo: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
});

dispatchRouter.post("/:invoiceId", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const input = upsertDispatchSchema.parse(req.body);

    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.invoiceId, outletId } });
    if (!invoice) throw new HttpError(404, "Invoice not found");

    const dispatch = await prisma.dispatch.upsert({
      where: { invoiceId: invoice.id },
      create: { outletId, invoiceId: invoice.id, ...input, status: "DISPATCHED", dispatchedAt: new Date() },
      update: { ...input, status: "DISPATCHED", dispatchedAt: new Date() },
      include: { invoice: { include: { customer: true } } },
    });

    res.json(toDispatchDTO(dispatch));
  } catch (err) {
    next(err);
  }
});

const markDeliveredSchema = z.object({
  podNote: z.string().optional(),
});

dispatchRouter.post("/:invoiceId/pod", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const input = markDeliveredSchema.parse(req.body);

    const dispatch = await prisma.dispatch.findFirst({ where: { invoiceId: req.params.invoiceId, outletId } });
    if (!dispatch) throw new HttpError(404, "No dispatch record for this invoice");

    const updated = await prisma.dispatch.update({
      where: { id: dispatch.id },
      data: { status: "DELIVERED", podReceivedAt: new Date(), podNote: input.podNote },
      include: { invoice: { include: { customer: true } } },
    });

    res.json(toDispatchDTO(updated));
  } catch (err) {
    next(err);
  }
});
