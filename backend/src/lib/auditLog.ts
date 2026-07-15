import { prisma } from "../prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "BULK_DELETE" | "RESTORE";
type AuditEntityType = "Customer" | "Item" | "Invoice" | "Announcement";

export function logAudit(params: {
  outletId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
}): void {
  // Fire-and-forget — a logging failure should never block the actual request.
  prisma.auditLog.create({ data: params }).catch((err) => {
    console.error("Failed to write audit log:", err);
  });
}
