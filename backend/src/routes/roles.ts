import { Router } from "express";
import { z } from "zod";
import { TAB_KEYS } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth, requireOwner } from "../middleware/auth";
import { parseTabs, serializeTabs } from "../lib/tabs";
import { HttpError } from "../middleware/errorHandler";

export const rolesRouter = Router();
rolesRouter.use(requireAuth, requireOwner);

const roleInputSchema = z.object({
  name: z.string().min(1),
  tabs: z.array(z.enum(TAB_KEYS)).min(1),
});

rolesRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const roles = await prisma.role.findMany({ where: { outletId }, orderBy: { createdAt: "asc" } });
    res.json(roles.map((r) => ({ id: r.id, name: r.name, tabs: parseTabs(r.tabs) })));
  } catch (err) {
    next(err);
  }
});

rolesRouter.post("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = roleInputSchema.parse(req.body);

    const role = await prisma.role.create({
      data: { outletId, name: data.name, tabs: serializeTabs(data.tabs) },
    });
    res.status(201).json({ id: role.id, name: role.name, tabs: parseTabs(role.tabs) });
  } catch (err) {
    next(err);
  }
});

rolesRouter.put("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = roleInputSchema.partial().parse(req.body);

    const existing = await prisma.role.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Role not found");

    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.tabs !== undefined ? { tabs: serializeTabs(data.tabs) } : {}),
      },
    });
    res.json({ id: role.id, name: role.name, tabs: parseTabs(role.tabs) });
  } catch (err) {
    next(err);
  }
});

rolesRouter.delete("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.role.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Role not found");

    const usersWithRole = await prisma.user.count({ where: { customRoleId: req.params.id } });
    if (usersWithRole > 0) throw new HttpError(400, "Cannot delete a role that is still assigned to users");

    await prisma.role.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
