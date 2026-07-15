import { Router } from "express";
import { z } from "zod";
import { ANNOUNCEMENT_CATEGORIES } from "@gss/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";
import { parsePagination } from "../lib/pagination";
import { logAudit } from "../lib/auditLog";

export const announcementsRouter = Router();
announcementsRouter.use(requireAuth);

const createAnnouncementSchema = z.object({
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  title: z.string().min(1),
  message: z.string().min(1),
});

announcementsRouter.get("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({ where: { outletId }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.announcement.count({ where: { outletId } }),
    ]);

    res.json({
      data: announcements.map((a) => ({
        id: a.id,
        authorId: a.authorId,
        authorName: a.authorName,
        category: a.category,
        title: a.title,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
        canDelete: a.authorId === req.user!.userId || req.user!.role === "OWNER",
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

announcementsRouter.post("/", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const data = createAnnouncementSchema.parse(req.body);

    const announcement = await prisma.announcement.create({
      data: { ...data, outletId, authorId: req.user!.userId, authorName: req.user!.name },
    });

    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "CREATE",
      entityType: "Announcement",
      entityId: announcement.id,
      summary: `Posted announcement "${announcement.title}"`,
    });

    res.status(201).json({
      id: announcement.id,
      authorId: announcement.authorId,
      authorName: announcement.authorName,
      category: announcement.category,
      title: announcement.title,
      message: announcement.message,
      createdAt: announcement.createdAt.toISOString(),
      canDelete: true,
    });
  } catch (err) {
    next(err);
  }
});

announcementsRouter.delete("/:id", async (req, res, next) => {
  try {
    const outletId = req.user!.outletId;
    const existing = await prisma.announcement.findFirst({ where: { id: req.params.id, outletId } });
    if (!existing) throw new HttpError(404, "Announcement not found");

    const canDelete = existing.authorId === req.user!.userId || req.user!.role === "OWNER";
    if (!canDelete) throw new HttpError(403, "Only the author or the outlet owner can delete this announcement");

    await prisma.announcement.delete({ where: { id: existing.id } });

    logAudit({
      outletId,
      userId: req.user!.userId,
      userName: req.user!.name,
      action: "DELETE",
      entityType: "Announcement",
      entityId: existing.id,
      summary: `Deleted announcement "${existing.title}"`,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
