import type { Prisma } from "@/generated/prisma/client"
import { dateRange } from "@/server/list"

export function auditLogWhere(
  companyId: string,
  filters: { entity?: string; action?: string; actor?: string; from?: string; to?: string; q?: string },
): Prisma.AuditLogWhereInput {
  return {
    companyId,
    ...(filters.entity ? { entityType: filters.entity } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actor ? (filters.actor === "platform" ? { actorType: "admin" } : { actorId: filters.actor }) : {}),
    ...(filters.from || filters.to ? { createdAt: dateRange(filters.from, filters.to) } : {}),
    ...(filters.q ? { OR: [{ summary: { contains: filters.q } }, { entityId: filters.q }, { actorName: { contains: filters.q } }] } : {}),
  }
}
