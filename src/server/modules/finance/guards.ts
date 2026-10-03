import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { businessRule } from "@/server/errors"
import type { TenantContext } from "@/server/auth/context"
import { date } from "@/lib/format"
import { dbDate } from "./calc"

/**
 * FIN-01: once a branch's cash is closed for a day, cash movements of that day are frozen —
 * only the owner may change them (and should then re-close the day).
 */
export async function assertCashDayOpen(tx: Prisma.TransactionClient, ctx: TenantContext, branchId: string, dayKey: string) {
  if (ctx.isOwner) return
  const closed = await tx.cashClosing.findFirst({ where: { companyId: ctx.companyId, branchId, date: dbDate(dayKey) }, select: { id: true } })
  if (closed) throw businessRule(`Cash for ${date(`${dayKey}T12:00:00`)} is already closed for this branch. Ask the owner to make this change.`)
}
