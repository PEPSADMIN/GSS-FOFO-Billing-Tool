import { Router } from "express";
import { z } from "zod";
import { deriveStateCode } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth, requireOwner } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

export const outletRouter = Router();
outletRouter.use(requireAuth);

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

const CIN_REGEX = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

const updateOutletSchema = z.object({
  name: z.string().min(1).optional(),
  gstin: z.string().regex(GST_REGEX, "Invalid GST format (e.g., 33AABCP9569P1ZM)").optional(),
  panCode: z.string().regex(PAN_REGEX, "Invalid PAN format (e.g., AABCP9569P)").optional(),
  cinNo: z.string().regex(CIN_REGEX, "Invalid CIN format (e.g., U52190KA1991PTC012623)").optional().or(z.literal("")),
  addressLine: z.string().min(1).optional(),
  regnAddress: z.string().optional(),
  city: z.string().min(1).optional(),
  pincode: z.string().regex(PINCODE_REGEX, "Invalid pincode format (6 digits)").optional(),
  phone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIfscCode: z.string().optional(),
});

outletRouter.get("/", async (req, res, next) => {
  try {
    const outlet = await prisma.outlet.findUnique({ where: { id: req.user!.outletId } });
    if (!outlet) throw new HttpError(404, "Outlet not found");
    res.json(outlet);
  } catch (err) {
    next(err);
  }
});

outletRouter.put("/", requireOwner, async (req, res, next) => {
  try {
    const data = updateOutletSchema.parse(req.body);
    const stateCode = data.gstin ? deriveStateCode(null, data.gstin) : undefined;

    const outlet = await prisma.outlet.update({
      where: { id: req.user!.outletId },
      data: {
        ...data,
        ...(stateCode ? { stateCode } : {}),
        panCode: data.panCode?.toUpperCase(),
      },
    });
    res.json(outlet);
  } catch (err) {
    next(err);
  }
});
