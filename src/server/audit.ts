import "server-only"
import { prisma } from "./db"
import type { TenantContext } from "./auth/context"
import type { Prisma } from "@/generated/prisma/client"

type Db = Pick<typeof prisma, "auditLog"> | Prisma.TransactionClient

/** AUD-01: who, what, before/after, when. Pass `tx` to write inside the business transaction. */
export async function audit(
  ctx: Pick<TenantContext, "companyId" | "userId" | "name"> | { admin: { id: string; name: string }; companyId?: string },
  entry: { action: string; entityType: string; entityId?: string; summary?: string; before?: unknown; after?: unknown },
  db: Db = prisma,
) {
  const isAdmin = "admin" in ctx
  await db.auditLog.create({
    data: {
      companyId: ctx.companyId ?? null,
      actorType: isAdmin ? "admin" : "user",
      actorId: isAdmin ? ctx.admin.id : ctx.userId,
      actorName: isAdmin ? ctx.admin.name : ctx.name,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary?.slice(0, 255) ?? null,
      before: entry.before === undefined ? undefined : JSON.parse(JSON.stringify(entry.before)),
      after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
    },
  })
}
