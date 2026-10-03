import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { assertBranch, branchFilter, can, type TenantContext } from "@/server/auth/context"
import type { TenantDb } from "@/server/db"
import { num, sum } from "@/server/decimal"
import { notFound } from "@/server/errors"
import { dateRange } from "@/server/list"
import { listParams } from "@/server/api"

/** List params shared by API GET handlers and server pages. */
export type ListArgs = {
  skip: number
  take: number
  orderBy: Record<string, "asc" | "desc">
  q?: string
  from?: string
  to?: string
  branchId?: string
  get: (k: string) => string | undefined
}

const nonAll = (v?: string) => (v && v !== "all" ? v : undefined)

async function customerIdsMatching(db: TenantDb, q?: string) {
  if (!q) return []
  const rows = await db.customer.findMany({
    where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { code: { contains: q } }] },
    select: { id: true },
    take: 200,
  })
  return rows.map((r) => r.id)
}

async function nameMaps(db: TenantDb, customerIds: (string | null)[], branchIds: string[]) {
  const ids = [...new Set(customerIds.filter((x): x is string => !!x))]
  const [customers, branches] = await Promise.all([
    ids.length ? db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, code: true } }) : [],
    db.branch.findMany({ where: { id: { in: [...new Set(branchIds)] } }, select: { id: true, name: true, code: true } }),
  ])
  return { customers: new Map(customers.map((c) => [c.id, c])), branches: new Map(branches.map((b) => [b.id, b])) }
}

// ───────── Money receipts ─────────

export async function listReceipts(ctx: TenantContext, db: TenantDb, p: ListArgs) {
  const method = nonAll(p.get("method"))
  const status = nonAll(p.get("status"))
  const kind = nonAll(p.get("kind"))
  const customerId = nonAll(p.get("customerId"))
  const custIds = await customerIdsMatching(db, p.q)
  const where: Prisma.MoneyReceiptWhereInput = {
    ...branchFilter(ctx, p.branchId),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { reference: { contains: p.q } }, { customerId: { in: custIds } }] } : {}),
    ...(method ? { method: method as Prisma.MoneyReceiptWhereInput["method"] } : {}),
    ...(status === "cancelled" ? { cancelledAt: { not: null } } : status === "active" ? { cancelledAt: null } : {}),
    ...(kind === "advance" ? { isAdvance: true } : kind === "payment" ? { isAdvance: false } : {}),
    ...(customerId ? { customerId } : {}),
    date: dateRange(p.from, p.to),
  }
  const [rows, total, agg] = await Promise.all([
    db.moneyReceipt.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.take, include: { allocations: true } }),
    db.moneyReceipt.count({ where }),
    db.moneyReceipt.aggregate({ where: { ...where, cancelledAt: null }, _sum: { amount: true } }),
  ])
  const invIds = [...new Set(rows.flatMap((r) => r.allocations.map((a) => a.invoiceId)))]
  const invoices = invIds.length ? await db.invoice.findMany({ where: { id: { in: invIds } }, select: { id: true, number: true } }) : []
  const invNo = new Map(invoices.map((i) => [i.id, i.number]))
  const maps = await nameMaps(db, rows.map((r) => r.customerId), rows.map((r) => r.branchId))
  return {
    total,
    sumAmount: num(agg._sum.amount),
    rows: rows.map((r) => {
      const allocated = sum(r.allocations.map((a) => a.amount))
      return {
        id: r.id,
        number: r.number,
        date: r.date.toISOString(),
        customerId: r.customerId,
        customerName: (r.customerId && maps.customers.get(r.customerId)?.name) || "—",
        branchName: maps.branches.get(r.branchId)?.name ?? "—",
        invoices: r.allocations.map((a) => ({ id: a.invoiceId, number: invNo.get(a.invoiceId) ?? "—" })),
        method: r.method,
        reference: r.reference,
        amount: num(r.amount),
        unallocated: r.cancelledAt ? 0 : num(r.amount.minus(allocated)),
        isAdvance: r.isAdvance,
        cancelled: !!r.cancelledAt,
        printCount: r.printCount,
      }
    }),
  }
}
export type ReceiptRow = Awaited<ReturnType<typeof listReceipts>>["rows"][number]


export async function receiptDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const r = await db.moneyReceipt.findFirst({ where: { id }, include: { allocations: true } })
  if (!r) throw notFound("Money receipt")
  assertBranch(ctx, r.branchId)
  const invoices = r.allocations.length
    ? await db.invoice.findMany({
        where: { id: { in: r.allocations.map((a) => a.invoiceId) } },
        select: { id: true, number: true, invoiceDate: true, total: true, dueAmount: true },
      })
    : []
  const inv = new Map(invoices.map((i) => [i.id, i]))
  const [maps, creator, company, branch] = await Promise.all([
    nameMaps(db, [r.customerId], [r.branchId]),
    r.createdById ? db.user.findFirst({ where: { id: r.createdById }, select: { name: true } }) : null,
    db.company.findUnique({ where: { id: ctx.companyId } }),
    db.branch.findFirst({ where: { id: r.branchId } }),
  ])
  const customer = r.customerId ? await db.customer.findFirst({ where: { id: r.customerId } }) : null
  const allocated = sum(r.allocations.map((a) => a.amount))
  return {
    id: r.id,
    number: r.number,
    date: r.date.toISOString(),
    branchName: maps.branches.get(r.branchId)?.name ?? "—",
    customer: customer
      ? { id: customer.id, code: customer.code, name: customer.name, phone: customer.phone, address: customer.address, balance: num(customer.balance) }
      : null,
    method: r.method,
    reference: r.reference,
    note: r.note,
    amount: num(r.amount),
    allocated: num(allocated),
    unallocated: r.cancelledAt ? 0 : num(r.amount.minus(allocated)),
    isAdvance: r.isAdvance,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    printCount: r.printCount,
    createdBy: creator?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    allocations: r.allocations.map((a) => {
      const i = inv.get(a.invoiceId)
      return {
        id: a.id,
        invoiceId: a.invoiceId,
        number: i?.number ?? "—",
        invoiceDate: i?.invoiceDate.toISOString() ?? null,
        invoiceTotal: num(i?.total),
        dueNow: num(i?.dueAmount),
        amount: num(a.amount),
      }
    }),
    company: company
      ? { name: company.name, address: company.address, phone: company.phone, email: company.email, logoUrl: company.logoUrl, binNumber: company.binNumber }
      : null,
    branch: branch ? { name: branch.name, address: branch.address, phone: branch.phone } : null,
  }
}
export type ReceiptDetail = Awaited<ReturnType<typeof receiptDetail>>

// ───────── Returns ─────────

export async function listReturns(ctx: TenantContext, db: TenantDb, p: ListArgs) {
  const status = nonAll(p.get("status"))
  const mode = nonAll(p.get("mode"))
  const custIds = await customerIdsMatching(db, p.q)
  const invMatches = p.q ? await db.invoice.findMany({ where: { number: { contains: p.q } }, select: { id: true }, take: 200 }) : []
  const where: Prisma.SalesReturnWhereInput = {
    ...branchFilter(ctx, p.branchId),
    ...(p.q
      ? { OR: [{ number: { contains: p.q } }, { customerId: { in: custIds } }, { invoiceId: { in: invMatches.map((i) => i.id) } }, { reason: { contains: p.q } }] }
      : {}),
    ...(status ? { status: status as Prisma.SalesReturnWhereInput["status"] } : {}),
    ...(mode ? { refundMode: mode as Prisma.SalesReturnWhereInput["refundMode"] } : {}),
    date: dateRange(p.from, p.to),
  }
  const [rows, total, pending] = await Promise.all([
    db.salesReturn.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.take, include: { _count: { select: { lines: true } } } }),
    db.salesReturn.count({ where }),
    db.salesReturn.count({ where: { ...branchFilter(ctx, p.branchId), status: "pending" } }),
  ])
  const invoices = await db.invoice.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.invoiceId))] } },
    select: { id: true, number: true, customerName: true },
  })
  const inv = new Map(invoices.map((i) => [i.id, i]))
  const maps = await nameMaps(db, rows.map((r) => r.customerId), rows.map((r) => r.branchId))
  return {
    total,
    pending,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date.toISOString(),
      invoiceId: r.invoiceId,
      invoiceNumber: inv.get(r.invoiceId)?.number ?? "—",
      customerName: (r.customerId && maps.customers.get(r.customerId)?.name) || inv.get(r.invoiceId)?.customerName || "Walk-in customer",
      branchName: maps.branches.get(r.branchId)?.name ?? "—",
      items: r._count.lines,
      refundMode: r.refundMode,
      restock: r.restock,
      reason: r.reason,
      totalAmount: num(r.totalAmount),
      status: r.status,
    })),
  }
}
export type ReturnRow = Awaited<ReturnType<typeof listReturns>>["rows"][number]

export async function returnDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const r = await db.salesReturn.findFirst({ where: { id }, include: { lines: true } })
  if (!r) throw notFound("Return")
  assertBranch(ctx, r.branchId)
  const showCost = can(ctx, "inventory.view_cost")
  const [invoice, variations, creditNote, users, company, branch, customer] = await Promise.all([
    db.invoice.findFirst({ where: { id: r.invoiceId }, include: { lines: { select: { id: true, quantity: true, returnedQty: true } } } }),
    db.productVariation.findMany({
      where: { id: { in: r.lines.map((l) => l.variationId) } },
      select: { id: true, name: true, sku: true, product: { select: { name: true, unit: true } } },
    }),
    db.creditNote.findFirst({ where: { returnId: r.id }, select: { id: true, number: true, amount: true } }),
    db.user.findMany({ where: { id: { in: [r.requestedById, r.approvedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    db.company.findUnique({ where: { id: ctx.companyId } }),
    db.branch.findFirst({ where: { id: r.branchId } }),
    r.customerId ? db.customer.findFirst({ where: { id: r.customerId } }) : null,
  ])
  const v = new Map(variations.map((x) => [x.id, x]))
  const u = new Map(users.map((x) => [x.id, x.name]))
  const sold = new Map(invoice?.lines.map((l) => [l.id, l]) ?? [])
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    date: r.date.toISOString(),
    refundMode: r.refundMode,
    restock: r.restock,
    reason: r.reason,
    rejectNote: r.rejectNote,
    totalAmount: num(r.totalAmount),
    costAmount: showCost ? num(r.costAmount) : null,
    requestedBy: r.requestedById ? (u.get(r.requestedById) ?? null) : null,
    decidedBy: r.approvedById ? (u.get(r.approvedById) ?? null) : null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    invoice: invoice
      ? {
          id: invoice.id,
          number: invoice.number,
          type: invoice.type,
          status: invoice.status,
          date: invoice.invoiceDate.toISOString(),
          total: num(invoice.total),
          dueAmount: num(invoice.dueAmount),
          customerName: invoice.customerName,
        }
      : null,
    customer: customer ? { id: customer.id, code: customer.code, name: customer.name, phone: customer.phone, address: customer.address } : null,
    creditNote: creditNote ? { id: creditNote.id, number: creditNote.number, amount: num(creditNote.amount) } : null,
    lines: r.lines.map((l) => {
      const x = v.get(l.variationId)
      const s = sold.get(l.invoiceLineId)
      return {
        id: l.id,
        productName: x?.product.name ?? "Item",
        variationName: x?.name ?? "",
        sku: x?.sku ?? "",
        unit: x?.product.unit ?? "pcs",
        quantity: num(l.quantity),
        soldQty: num(s?.quantity),
        returnedQty: num(s?.returnedQty),
        unitPrice: num(l.unitPrice),
        amount: num(l.amount),
        unitCost: showCost ? num(l.unitCost) : null,
      }
    }),
    company: company ? { name: company.name, address: company.address, phone: company.phone, email: company.email, binNumber: company.binNumber } : null,
    branch: branch ? { name: branch.name, address: branch.address, phone: branch.phone } : null,
  }
}
export type ReturnDetail = Awaited<ReturnType<typeof returnDetail>>

// ───────── Credit notes ─────────

export async function listCreditNotes(ctx: TenantContext, db: TenantDb, p: ListArgs) {
  const source = nonAll(p.get("source"))
  const custIds = await customerIdsMatching(db, p.q)
  const where: Prisma.CreditNoteWhereInput = {
    ...branchFilter(ctx, p.branchId),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { customerId: { in: custIds } }, { reason: { contains: p.q } }] } : {}),
    ...(source === "return" ? { returnId: { not: null } } : source === "manual" ? { returnId: null } : {}),
    date: dateRange(p.from, p.to),
  }
  const [rows, total, agg] = await Promise.all([
    db.creditNote.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.take }),
    db.creditNote.count({ where }),
    db.creditNote.aggregate({ where, _sum: { amount: true } }),
  ])
  const [invoices, returns, maps] = await Promise.all([
    db.invoice.findMany({ where: { id: { in: rows.map((r) => r.invoiceId).filter((x): x is string => !!x) } }, select: { id: true, number: true } }),
    db.salesReturn.findMany({ where: { id: { in: rows.map((r) => r.returnId).filter((x): x is string => !!x) } }, select: { id: true, number: true } }),
    nameMaps(db, rows.map((r) => r.customerId), rows.map((r) => r.branchId)),
  ])
  const inv = new Map(invoices.map((i) => [i.id, i.number]))
  const ret = new Map(returns.map((i) => [i.id, i.number]))
  return {
    total,
    sumAmount: num(agg._sum.amount),
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date.toISOString(),
      customerId: r.customerId,
      customerName: maps.customers.get(r.customerId)?.name ?? "—",
      branchName: maps.branches.get(r.branchId)?.name ?? "—",
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceId ? (inv.get(r.invoiceId) ?? "—") : null,
      returnId: r.returnId,
      returnNumber: r.returnId ? (ret.get(r.returnId) ?? "—") : null,
      amount: num(r.amount),
      reason: r.reason,
    })),
  }
}
export type CreditNoteRow = Awaited<ReturnType<typeof listCreditNotes>>["rows"][number]

export async function creditNoteDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const c = await db.creditNote.findFirst({ where: { id } })
  if (!c) throw notFound("Credit note")
  assertBranch(ctx, c.branchId)
  const [customer, invoice, ret, creator, branch, ledger] = await Promise.all([
    db.customer.findFirst({ where: { id: c.customerId } }),
    c.invoiceId ? db.invoice.findFirst({ where: { id: c.invoiceId }, select: { id: true, number: true, total: true, dueAmount: true, status: true } }) : null,
    c.returnId ? db.salesReturn.findFirst({ where: { id: c.returnId }, select: { id: true, number: true, status: true } }) : null,
    c.createdById ? db.user.findFirst({ where: { id: c.createdById }, select: { name: true } }) : null,
    db.branch.findFirst({ where: { id: c.branchId }, select: { name: true } }),
    db.customerLedgerEntry.findFirst({ where: { refType: "credit_note", refId: c.id }, select: { balanceAfter: true } }),
  ])
  return {
    id: c.id,
    number: c.number,
    date: c.date.toISOString(),
    amount: num(c.amount),
    reason: c.reason,
    branchName: branch?.name ?? "—",
    createdBy: creator?.name ?? null,
    customer: customer ? { id: customer.id, code: customer.code, name: customer.name, phone: customer.phone, balance: num(customer.balance) } : null,
    invoice: invoice ? { id: invoice.id, number: invoice.number, total: num(invoice.total), dueAmount: num(invoice.dueAmount), status: invoice.status } : null,
    salesReturn: ret,
    balanceAfter: ledger ? num(ledger.balanceAfter) : null,
  }
}
export type CreditNoteDetail = Awaited<ReturnType<typeof creditNoteDetail>>

// ───────── Quotations & orders ─────────

export async function listOrders(ctx: TenantContext, db: TenantDb, p: ListArgs) {
  const type = nonAll(p.get("type"))
  const status = nonAll(p.get("status"))
  const custIds = await customerIdsMatching(db, p.q)
  const where: Prisma.SalesOrderWhereInput = {
    ...branchFilter(ctx, p.branchId),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { customerId: { in: custIds } }, { note: { contains: p.q } }] } : {}),
    ...(type ? { type: type as Prisma.SalesOrderWhereInput["type"] } : {}),
    ...(status ? { status: status as Prisma.SalesOrderWhereInput["status"] } : {}),
    date: dateRange(p.from, p.to),
  }
  const [rows, total] = await Promise.all([
    db.salesOrder.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.take, include: { _count: { select: { lines: true } } } }),
    db.salesOrder.count({ where }),
  ])
  const maps = await nameMaps(db, rows.map((r) => r.customerId), rows.map((r) => r.branchId))
  const today = new Date().toISOString().slice(0, 10)
  return {
    total,
    rows: rows.map((r) => {
      const validUntil = r.validUntil ? r.validUntil.toISOString().slice(0, 10) : null
      return {
        id: r.id,
        number: r.number,
        type: r.type,
        status: r.status,
        date: r.date.toISOString().slice(0, 10),
        validUntil,
        expired: r.status === "open" && !!validUntil && validUntil < today,
        customerName: (r.customerId && maps.customers.get(r.customerId)?.name) || null,
        branchName: maps.branches.get(r.branchId)?.name ?? "—",
        items: r._count.lines,
        total: num(r.total),
        advanceAmount: num(r.advanceAmount),
      }
    }),
  }
}
export type OrderRow = Awaited<ReturnType<typeof listOrders>>["rows"][number]

/** ListArgs from an API request (?page&limit&sort&q&from&to&branchId + module filters). */
export function listArgsFromRequest(req: Request, sortable: string[], defaultSort: string) {
  const p = listParams(req, sortable, defaultSort)
  return {
    page: p.page,
    limit: p.limit,
    args: { skip: p.skip, take: p.limit, orderBy: p.orderBy, q: p.q, from: p.from, to: p.to, branchId: p.branchId, get: (k: string) => p.sp.get(k) ?? undefined } satisfies ListArgs,
  }
}
