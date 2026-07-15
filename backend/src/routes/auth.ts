import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma";
import { signToken } from "../middleware/auth";
import { resolveUserTabs } from "../lib/tabs";

export const authRouter = Router();

const loginSchema = z.object({
  phone: z.string().min(3),
  password: z.string().min(1),
});

// 10 attempts per 15 minutes per IP — slows down brute-force password guessing without
// getting in the way of a cashier mistyping their password a couple of times.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Kindly wait a few minutes and try again." },
});

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { phone }, include: { customRole: true } });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    const outlet = await prisma.outlet.findUnique({ where: { id: user.outletId } });
    if (!outlet) {
      return res.status(500).json({ error: "User has no associated outlet" });
    }

    const tabs = resolveUserTabs(user.role, user.customRole?.tabs);
    const token = signToken({ userId: user.id, outletId: user.outletId, role: user.role, tabs, name: user.name });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        outletId: user.outletId,
        tabs,
        languageCode: user.languageCode,
        themeId: user.themeId,
        fontScale: user.fontScale,
        customBackground: user.customBackground,
        customTextColor: user.customTextColor,
      },
      outlet: {
        id: outlet.id,
        name: outlet.name,
        gstin: outlet.gstin,
        stateCode: outlet.stateCode,
        panCode: outlet.panCode,
      },
    });
  } catch (err) {
    next(err);
  }
});
