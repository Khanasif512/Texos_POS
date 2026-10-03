import "server-only"
import type { Prisma } from "@/generated/prisma/client"

type Tx = Prisma.TransactionClient

/**
 * Document numbers, sequential per company + scope (branch or "company") + key + year.
 * Call inside the business transaction so numbers are never skipped or duplicated.
 *
 *   nextNumber(tx, { companyId, key: "INV", branchId, branchCode: "HO" })  -> "INV-HO-26-00001"
 *   nextNumber(tx, { companyId, key: "CUS", yearly: false })              -> "CUS-00001"
 */
export async function nextNumber(
  tx: Tx,
  opts: { companyId: string; key: string; branchId?: string | null; branchCode?: string | null; date?: Date; yearly?: boolean; pad?: number },
) {
  const yearly = opts.yearly ?? true
  const year = yearly ? (opts.date ?? new Date()).getFullYear() : 0
  const scope = opts.branchId ?? "company"
  const where = { companyId_scope_key_year: { companyId: opts.companyId, scope, key: opts.key, year } }
  let row
  try {
    row = await tx.sequence.upsert({
      where,
      create: { companyId: opts.companyId, scope, key: opts.key, year, next: 2 },
      update: { next: { increment: 1 } },
    })
  } catch {
    // concurrent first insert for the same sequence — the row exists now
    row = await tx.sequence.update({ where, data: { next: { increment: 1 } } })
  }
  const n = String(row.next - 1).padStart(opts.pad ?? 5, "0")
  const parts = [opts.key]
  if (opts.branchCode) parts.push(opts.branchCode)
  if (yearly) parts.push(String(year).slice(2))
  parts.push(n)
  return parts.join("-")
}
