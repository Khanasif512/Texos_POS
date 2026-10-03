import "server-only"
import { format } from "date-fns"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { businessRule, notFound } from "@/server/errors"
import { assertBranch, type TenantContext } from "@/server/auth/context"
import { dec, type Dec } from "@/server/decimal"
import { D } from "./calc"

export type Tx = Prisma.TransactionClient

/** Transaction options for after-sale postings (stock + ledger + documents in one unit — NFR-AVL-02). */
export const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const

export const run = <T>(fn: (tx: Tx) => Promise<T>) => prisma.$transaction(fn, TX_OPTS)

/** Convert a decimal.js value from ./calc into a Prisma Decimal. */
export const pd = (v: ReturnType<typeof D>): Dec => dec(v.toFixed(2))

/** Document timestamp for a yyyy-mm-dd picked in a form: today keeps the current time, other days use local noon. */
export function docDateTime(s: string) {
  const now = new Date()
  return s === format(now, "yyyy-MM-dd") ? now : new Date(`${s}T12:00:00`)
}

/** Value for a `@db.Date` column (stored as the calendar day, no timezone shift). */
export const dbDate = (s: string) => new Date(`${s}T00:00:00.000Z`)

/** Lock a customer row for the rest of the transaction (serialises receipts/returns per customer). */
export async function lockCustomer(tx: Tx, companyId: string, customerId: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM customers WHERE id = ${customerId} AND companyId = ${companyId} FOR UPDATE`
  if (!row) throw notFound("Customer")
  return tx.customer.findUniqueOrThrow({ where: { id: customerId } })
}

/** Lock invoices (sorted by id to keep a stable lock order) and return them. */
export async function lockInvoices(tx: Tx, companyId: string, ids: string[]) {
  const unique = [...new Set(ids)].sort()
  if (!unique.length) return []
  await tx.$queryRaw`SELECT id FROM invoices WHERE companyId = ${companyId} AND id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`
  return tx.invoice.findMany({ where: { companyId, id: { in: unique } } })
}

export async function branchFor(tx: Tx, ctx: TenantContext, branchId: string) {
  assertBranch(ctx, branchId)
  const branch = await tx.branch.findFirst({ where: { id: branchId, companyId: ctx.companyId, status: "active" } })
  if (!branch) throw businessRule("Choose an active branch")
  return branch
}

/** Invoices that can take payments / advances. */
export const OPEN_INVOICE_STATUSES = ["confirmed", "partially_returned", "returned"] as const

export const isOpenForPayment = (inv: { status: string; dueAmount: Prisma.Decimal }) =>
  (OPEN_INVOICE_STATUSES as readonly string[]).includes(inv.status) && dec(inv.dueAmount).gt(0)

/** Marker written in the note of an order's advance receipt, so cancelling the receipt can adjust the order. */
export const ADVANCE_NOTE_PREFIX = "Advance for order "
