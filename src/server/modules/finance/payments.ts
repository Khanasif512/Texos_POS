import "server-only"
import { prisma, type TenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, assertFeature, type TenantContext } from "@/server/auth/context"
import { nextNumber } from "@/server/modules/common/sequence"
import { postSupplierLedger } from "@/server/modules/ledger/service"
import { num, round2 } from "@/server/decimal"
import type { SupplierPaymentOutput } from "@/lib/validation/finance"
import { dayBounds, dayKey } from "./calc"
import { assertCashDayOpen } from "./guards"

export type PayableRow = {
  id: string
  code: string
  name: string
  country: string | null
  currency: string
  status: string
  purchases: number
  payments: number
  outstanding: number
  lastPaymentAt: string | null
  openLcs: number
}

/** FIN-03: per supplier — Σ ledger credits (purchases / LC value / opening), Σ debits (payments), outstanding = cached balance. */
export async function payablesOverview(db: TenantDb): Promise<PayableRow[]> {
  const [suppliers, sums, lastPay, lcs] = await Promise.all([
    db.supplier.findMany({ orderBy: [{ balance: "desc" }, { name: "asc" }], select: { id: true, code: true, name: true, country: true, currency: true, status: true, balance: true } }),
    db.supplierLedgerEntry.groupBy({ by: ["supplierId"], _sum: { credit: true, debit: true } }),
    db.supplierPayment.groupBy({ by: ["supplierId"], _max: { date: true } }),
    db.lc.groupBy({ by: ["supplierId"], where: { status: { notIn: ["closed", "draft"] } }, _count: { _all: true } }),
  ])
  const s = new Map(sums.map((r) => [r.supplierId, r._sum]))
  const p = new Map(lastPay.map((r) => [r.supplierId, r._max.date]))
  const l = new Map(lcs.map((r) => [r.supplierId, r._count._all]))
  return suppliers
    .map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      country: x.country,
      currency: x.currency,
      status: x.status,
      purchases: num(s.get(x.id)?.credit),
      payments: num(s.get(x.id)?.debit),
      outstanding: num(x.balance),
      lastPaymentAt: p.get(x.id)?.toISOString() ?? null,
      openLcs: l.get(x.id) ?? 0,
    }))
    .filter((r) => r.status === "active" || r.outstanding !== 0 || r.purchases !== 0)
}

/** Payment time: the chosen day, at the current time of day when it is today (keeps same-day ordering). */
function paymentTimestamp(key: string) {
  const now = new Date()
  return key === dayKey(now) ? now : new Date(dayBounds(key).gte.getTime() + 12 * 3_600_000)
}

/** FIN-03: SupplierPayment (SP number) + supplier ledger debit in one transaction. */
export async function createSupplierPayment(ctx: TenantContext, input: SupplierPaymentOutput) {
  assertBranch(ctx, input.branchId)
  if (input.date > dayKey(new Date())) throw new AppError("VALIDATION_ERROR", "Payment date cannot be in the future", { fields: { date: "Future date" } })
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, companyId: ctx.companyId, status: "active" }, select: { id: true, code: true } })
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId: ctx.companyId }, select: { id: true, name: true } })
    if (!branch) throw new AppError("VALIDATION_ERROR", "Choose an active branch", { fields: { branchId: "Invalid branch" } })
    if (!supplier) throw new AppError("VALIDATION_ERROR", "Choose a valid supplier", { fields: { supplierId: "Supplier not found" } })
    let lcNumber: string | null = null
    if (input.lcId) {
      assertFeature(ctx, "lc")
      const lc = await tx.lc.findFirst({ where: { id: input.lcId, companyId: ctx.companyId }, select: { supplierId: true, lcNumber: true } })
      if (!lc) throw new AppError("VALIDATION_ERROR", "Choose a valid LC", { fields: { lcId: "LC not found" } })
      if (lc.supplierId !== supplier.id) throw new AppError("VALIDATION_ERROR", "This LC belongs to another supplier", { fields: { lcId: "Different supplier" } })
      lcNumber = lc.lcNumber
    }
    if (input.method === "cash") await assertCashDayOpen(tx, ctx, branch.id, input.date)

    const when = paymentTimestamp(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "SP", branchId: branch.id, branchCode: branch.code, date: when })
    const amount = round2(input.amount)
    const payment = await tx.supplierPayment.create({
      data: {
        companyId: ctx.companyId,
        branchId: branch.id,
        supplierId: supplier.id,
        lcId: input.lcId,
        number,
        amount,
        method: input.method,
        reference: input.reference,
        note: input.note,
        date: when,
        createdById: ctx.userId,
      },
    })
    const balance = await postSupplierLedger(tx, {
      companyId: ctx.companyId,
      supplierId: supplier.id,
      type: "payment",
      debit: amount,
      refType: "supplier_payment",
      refId: payment.id,
      note: `Payment ${number}${lcNumber ? ` · LC ${lcNumber}` : ""}${input.reference ? ` · ${input.reference}` : ""}`.slice(0, 255),
      date: when,
      userId: ctx.userId,
    })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "supplier_payment",
        entityId: payment.id,
        summary: `Paid ${supplier.name} ৳${amount.toFixed(2)} (${number})`,
        after: { number, supplierId: supplier.id, amount: amount.toString(), method: input.method, lcId: input.lcId, date: input.date, balanceAfter: balance.toString() },
      },
      tx,
    )
    return { id: payment.id, number, supplierName: supplier.name, amount: num(amount), balance: num(balance) }
  })
}
