import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role as RoleString } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth, requireOwner } from "../middleware/auth";
import { toUserDTO } from "../lib/userDto";
import { HttpError } from "../middleware/errorHandler";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireOwner);

const ROLE_VALUES: [RoleString, ...RoleString[]] = ["OWNER", "ADMIN", "CASHIER"];

const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(ROLE_VALUES).optional(),
  customRoleId: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  customRoleId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const users = await prisma.user.findMany({
      where: { outletId },
      include: { customRole: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users.map(toUserDTO));
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = createUserSchema.parse(req.body);

    if (data.customRoleId) {
      const role = await prisma.role.findFirst({ where: { id: data.customRoleId, outletId } });
      if (!role) throw new HttpError(400, "Custom role not found");
    }

    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new HttpError(409, "A user with this phone number already exists");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        outletId,
        name: data.name,
        phone: data.phone,
        passwordHash,
        role: data.role ?? "CASHIER",
        customRoleId: data.customRoleId,
      },
      include: { customRole: true },
    });
    res.status(201).json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = updateUserSchema.parse(req.body);

    const existing = await prisma.user.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "User not found");

    if (data.customRoleId) {
      const role = await prisma.role.findFirst({ where: { id: data.customRoleId, outletId } });
      if (!role) throw new HttpError(400, "Custom role not found");
    }

    if (data.phone && data.phone !== existing.phone) {
      const phoneTaken = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (phoneTaken) throw new HttpError(409, "A user with this phone number already exists");
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.customRoleId !== undefined ? { customRoleId: data.customRoleId } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: { customRole: true },
    });
    res.json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});
