import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { LANGUAGES, THEME_PALETTES, CUSTOM_THEME_ID, isValidHexColor } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { toUserDTO } from "../lib/userDto";
import { HttpError } from "../middleware/errorHandler";

export const meRouter = Router();
meRouter.use(requireAuth);

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]];
const THEME_IDS = [...THEME_PALETTES.map((t) => t.id), CUSTOM_THEME_ID] as unknown as [string, ...string[]];

meRouter.get("/", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { customRole: true },
    });
    if (!user) throw new HttpError(404, "User not found");
    res.json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});

const updatePreferencesSchema = z.object({
  languageCode: z.enum(LANGUAGE_CODES).optional(),
  themeId: z.enum(THEME_IDS).optional(),
  fontScale: z.number().min(0.7).max(1.6).optional(),
  customBackground: z.string().refine(isValidHexColor, "Must be a hex color like #112233").optional(),
  customTextColor: z.string().refine(isValidHexColor, "Must be a hex color like #112233").optional(),
});

meRouter.put("/preferences", async (req, res, next) => {
  try {
    const data = updatePreferencesSchema.parse(req.body);

    if (data.themeId === CUSTOM_THEME_ID) {
      const existing = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      const bg = data.customBackground ?? existing?.customBackground;
      const text = data.customTextColor ?? existing?.customTextColor;
      if (!bg || !text) {
        throw new HttpError(400, "Custom theme requires both a background color and a font color");
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(data.languageCode !== undefined ? { languageCode: data.languageCode } : {}),
        ...(data.themeId !== undefined ? { themeId: data.themeId } : {}),
        ...(data.fontScale !== undefined ? { fontScale: data.fontScale } : {}),
        ...(data.customBackground !== undefined ? { customBackground: data.customBackground } : {}),
        ...(data.customTextColor !== undefined ? { customTextColor: data.customTextColor } : {}),
      },
      include: { customRole: true },
    });
    res.json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

meRouter.post("/change-password", async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new HttpError(404, "User not found");

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) throw new HttpError(401, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
