import "server-only"
import type { Prisma, Supplier } from "@/generated/prisma/client"
import { prisma, type TenantDb } from "@/server/db"
import { businessRule, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { branchFilter, can, type TenantContext } from "@/server/auth/context"
import { dec, num } from "@/server/decimal"
import { nextNumber } from "@/server/modules/common/sequence"
import { postSupplierLedger } from "@/server/modules/ledger/service"
import type { SupplierOutput } from "@/lib/validation/suppliers"

export const SUPPLIER_SORTABLE = ["name", "code", "country", "balance", "createdAt"]

type ListArgs = {
  q?: string
  status?: string
  currency?: string
  skip: number
  take: number
  orderBy: Record<string, "asc" | "desc">
}

const profileData = (input: SupplierOutput) => ({
  name: input.name,
  country: input.country,
  contactPerson: input.contactPerson,
  phone: input.phone,
  email: input.email,
  address: input.address,
  bankDetails: input.bankDetails,
  currency: input.currency,
  notes: input.notes,
  status: input.status,
})

/** SUP-02: list with aggregate purchase value and outstanding payable per supplier. */
export async function listSuppliers(db: TenantDb, a: ListArgs) {
  const where: Prisma.SupplierWhereInput = {
    ...(a.q ? { OR: [{ name: { contains: a.q } }, { code: { contains: a.q } }, { country: { contains: a.q } }, { contactPerson: { contains: a.q } }] } : {}),
    ...(a.status === "active" || a.status === "inactive" ? { status: a.status } : {}),
    ...(a.currency === "RMB" || a.currency === "USD" || a.currency === "BDT" ? { currency: a.currency } : {}),
  }
  const [rows, total] = await Promise.all([
    db.supplier.findMany({ where, orderBy: a.orderBy, skip: a.skip, take: a.take }),
    db.supplier.count({ where }),
  ])
  const purchases = rows.length
    ? await db.supplierLedgerEntry.groupBy({
        by: ["supplierId"],
        where: { supplierId: { in: rows.map((r) => r.id) }, type: "purchase" },
        _sum: { credit: true },
      })
    : []
  const purchaseMap = new Map(purchases.map((p) => [p.supplierId, num(p._sum.credit)]))
  return {
    total,
    rows: rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      country: s.country,
      currency: s.currency,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      totalPurchases: purchaseMap.get(s.id) ?? 0,
      balance: num(s.balance),
      status: s.status,
    })),
  }
}
export type SupplierListRow = Awaited<ReturnType<typeof listSuppliers>>["rows"][number]

export function supplierDto(s: Supplier) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    country: s.country,
    contactPerson: s.contactPerson,
    phone: s.phone,
    email: s.email,
    address: s.address,
    bankDetails: s.bankDetails,
    currency: s.currency,
    openingBalance: num(s.openingBalance),
    balance: num(s.balance),
    notes: s.notes,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }
}
export type SupplierDto = ReturnType<typeof supplierDto>

export async function getSupplier(db: TenantDb, id: string) {
  const s = await db.supplier.findFirst({ where: { id } })
  if (!s) throw notFound("Supplier")
  return supplierDto(s)
}

/** Supplier detail (SUP-02): stats, full ledger with running balance, LCs and POs. */
export async function getSupplierDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const s = await db.supplier.findFirst({ where: { id } })
  if (!s) throw notFound("Supplier")
  const showLc = ctx.plan.features.lc && can(ctx, "lc.view")
  const showPo = ctx.plan.features.purchase && can(ctx, "purchase.view")
  const [purchases, paid, ledgerDesc, ledgerCount, lcs, pos] = await Promise.all([
    db.supplierLedgerEntry.aggregate({ where: { supplierId: id, type: "purchase" }, _sum: { credit: true } }),
    db.supplierLedgerEntry.aggregate({ where: { supplierId: id }, _sum: { debit: true } }),
    db.supplierLedgerEntry.findMany({ where: { supplierId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 }),
    db.supplierLedgerEntry.count({ where: { supplierId: id } }),
    showLc
      ? db.lc.findMany({ where: { supplierId: id, ...branchFilter(ctx) }, orderBy: { createdAt: "desc" }, take: 100 })
      : Promise.resolve([]),
    showPo
      ? db.purchaseOrder.findMany({ where: { supplierId: id, ...branchFilter(ctx) }, orderBy: { orderDate: "desc" }, take: 100 })
      : Promise.resolve([]),
  ])
  return {
    supplier: supplierDto(s),
    stats: {
      totalPurchases: num(purchases._sum.credit),
      totalPaid: num(paid._sum.debit),
      outstanding: num(s.balance),
    },
    ledgerCount,
    ledger: ledgerDesc.reverse().map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      type: e.type,
      refType: e.refType,
      refId: e.refId,
      note: e.note,
      debit: num(e.debit),
      credit: num(e.credit),
      balance: num(e.balanceAfter),
    })),
    lcs: showLc
      ? lcs.map((l) => ({
          id: l.id,
          lcNumber: l.lcNumber,
          status: l.status,
          currency: l.currency,
          lcValue: num(l.lcValue),
          openedDate: l.openedDate?.toISOString() ?? null,
        }))
      : null,
    purchaseOrders: showPo
      ? pos.map((p) => ({
          id: p.id,
          number: p.number,
          status: p.status,
          orderDate: p.orderDate.toISOString(),
          totalBdt: num(p.totalBdt),
        }))
      : null,
  }
}
export type SupplierDetail = Awaited<ReturnType<typeof getSupplierDetail>>

export async function createSupplier(ctx: TenantContext, input: SupplierOutput) {
  const opening = dec(input.openingBalance)
  return prisma.$transaction(async (tx) => {
    const code = await nextNumber(tx, { companyId: ctx.companyId, key: "SUP", yearly: false })
    const supplier = await tx.supplier.create({
      data: { ...profileData(input), companyId: ctx.companyId, code, openingBalance: opening },
    })
    if (opening.gt(0)) {
      await postSupplierLedger(tx, {
        companyId: ctx.companyId,
        supplierId: supplier.id,
        type: "opening",
        credit: opening,
        refType: "supplier",
        refId: supplier.id,
        note: "Opening balance",
        userId: ctx.userId,
      })
    }
    const after = await tx.supplier.findUniqueOrThrow({ where: { id: supplier.id } })
    await audit(
      ctx,
      { action: "create", entityType: "supplier", entityId: supplier.id, summary: `Created supplier ${code} ${supplier.name}`, after: supplierDto(after) },
      tx,
    )
    return supplierDto(after)
  })
}

/** Profile fields only — opening balance is fixed at creation; balances change through the ledger. */
export async function updateSupplier(ctx: TenantContext, db: TenantDb, id: string, input: SupplierOutput) {
  const before = await db.supplier.findFirst({ where: { id } })
  if (!before) throw notFound("Supplier")
  const after = await db.supplier.update({ where: { id }, data: profileData(input) })
  await audit(ctx, {
    action: "update",
    entityType: "supplier",
    entityId: id,
    summary: `Updated supplier ${after.code} ${after.name}${before.status !== after.status ? ` (${after.status})` : ""}`,
    before: supplierDto(before),
    after: supplierDto(after),
  })
  return supplierDto(after)
}

/** Delete only a supplier nobody has traded with yet; otherwise it must be deactivated. */
export async function deleteSupplier(ctx: TenantContext, db: TenantDb, id: string) {
  const s = await db.supplier.findFirst({ where: { id } })
  if (!s) throw notFound("Supplier")
  const [activity, lcs, pos, payments] = await Promise.all([
    db.supplierLedgerEntry.count({ where: { supplierId: id, type: { not: "opening" } } }),
    db.lc.count({ where: { supplierId: id } }),
    db.purchaseOrder.count({ where: { supplierId: id } }),
    db.supplierPayment.count({ where: { supplierId: id } }),
  ])
  if (activity || lcs || pos || payments)
    throw businessRule("This supplier has LCs, purchases or payments on record and cannot be deleted. Mark it inactive instead.")
  await prisma.$transaction(async (tx) => {
    await tx.supplierLedgerEntry.deleteMany({ where: { supplierId: id, companyId: ctx.companyId } })
    await tx.supplier.delete({ where: { id } })
    await audit(ctx, { action: "delete", entityType: "supplier", entityId: id, summary: `Deleted supplier ${s.code} ${s.name}`, before: supplierDto(s) }, tx)
  })
}
