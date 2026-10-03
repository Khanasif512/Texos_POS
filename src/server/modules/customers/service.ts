import "server-only"
import type { Customer, Prisma } from "@/generated/prisma/client"
import { prisma, type TenantDb } from "@/server/db"
import { AppError, businessRule, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, type TenantContext } from "@/server/auth/context"
import { dec, num, sum } from "@/server/decimal"
import { nextNumber } from "@/server/modules/common/sequence"
import { postCustomerLedger } from "@/server/modules/ledger/service"
import type { CustomerOutput, CustomerUpdateOutput } from "@/lib/validation/customers"
import { money } from "@/lib/format"

export const CUSTOMER_SORTABLE = ["name", "code", "balance", "creditLimit", "createdAt"]

/** Public shape used by the POS quick-add and pickers (API contract — keep stable). */
export function customerDto(c: Customer) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
    address: c.address,
    type: c.type,
    creditLimit: num(c.creditLimit),
    balance: num(c.balance),
  }
}
export type CustomerDto = ReturnType<typeof customerDto>

/** Full profile for the edit form / detail page. */
export function customerProfile(c: Customer) {
  return {
    ...customerDto(c),
    email: c.email,
    notes: c.notes,
    branchId: c.branchId,
    openingBalance: num(c.openingBalance),
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  }
}
export type CustomerProfile = ReturnType<typeof customerProfile>

type ListArgs = { q?: string; type?: string; status?: string; skip: number; take: number; orderBy: Record<string, "asc" | "desc"> }

export async function listCustomers(db: TenantDb, a: ListArgs) {
  const where: Prisma.CustomerWhereInput = {
    ...(a.q ? { OR: [{ name: { contains: a.q } }, { phone: { contains: a.q } }, { code: { contains: a.q } }] } : {}),
    ...(a.type === "retail" || a.type === "wholesale" || a.type === "dealer" ? { type: a.type } : {}),
    ...(a.status === "active" || a.status === "inactive" ? { status: a.status } : {}),
  }
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, orderBy: a.orderBy, skip: a.skip, take: a.take }),
    db.customer.count({ where }),
  ])
  return { total, rows: rows.map((c) => ({ ...customerDto(c), status: c.status })) }
}
export type CustomerListRow = Awaited<ReturnType<typeof listCustomers>>["rows"][number]

export async function getCustomer(db: TenantDb, id: string) {
  const c = await db.customer.findFirst({ where: { id } })
  if (!c) throw notFound("Customer")
  return c
}

async function checkBranch(ctx: TenantContext, db: TenantDb, branchId: string | null) {
  if (!branchId) return
  const b = await db.branch.findFirst({ where: { id: branchId }, select: { id: true } })
  if (!b) throw new AppError("VALIDATION_ERROR", "Choose a valid branch", { fields: { branchId: "Invalid branch" } })
  assertBranch(ctx, branchId)
}

/** Avoid duplicate customer cards for the same phone number (POS quick-add searches by phone). */
async function checkPhone(db: TenantDb, phone: string | null, exceptId?: string) {
  if (!phone) return
  const dup = await db.customer.findFirst({ where: { phone, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { code: true, name: true } })
  if (dup)
    throw new AppError("CONFLICT", `This phone number already belongs to ${dup.name} (${dup.code})`, {
      fields: { phone: `Already used by ${dup.name} (${dup.code})` },
    })
}

/** CRM-02: opening balance is set once here and posted to the ledger in the same transaction. */
export async function createCustomer(ctx: TenantContext, db: TenantDb, input: CustomerOutput) {
  await checkBranch(ctx, db, input.branchId)
  await checkPhone(db, input.phone)
  const opening = dec(input.openingBalance)
  return prisma.$transaction(async (tx) => {
    const code = await nextNumber(tx, { companyId: ctx.companyId, key: "CUS", yearly: false })
    const c = await tx.customer.create({
      data: {
        companyId: ctx.companyId,
        branchId: input.branchId,
        code,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        type: input.type,
        creditLimit: input.creditLimit,
        openingBalance: opening,
        notes: input.notes,
        status: input.status,
      },
    })
    if (!opening.isZero()) {
      const due = opening.gt(0)
      await postCustomerLedger(tx, {
        companyId: ctx.companyId,
        customerId: c.id,
        branchId: input.branchId,
        type: "opening",
        ...(due ? { debit: opening } : { credit: opening.abs() }),
        refType: "customer",
        refId: c.id,
        note: due ? "Opening balance (due)" : "Opening balance (advance)",
        userId: ctx.userId,
      })
    }
    const after = await tx.customer.findUniqueOrThrow({ where: { id: c.id } })
    await audit(
      ctx,
      { action: "create", entityType: "customer", entityId: c.id, summary: `Created customer ${code} ${c.name}`, after: customerProfile(after) },
      tx,
    )
    return customerDto(after)
  })
}

/** Profile + credit limit (AUD-01: credit-limit changes are audited). Opening balance never changes here. */
export async function updateCustomer(ctx: TenantContext, db: TenantDb, id: string, input: CustomerUpdateOutput) {
  const before = await getCustomer(db, id)
  if (input.branchId !== before.branchId) await checkBranch(ctx, db, input.branchId)
  await checkPhone(db, input.phone, id)
  const after = await db.customer.update({
    where: { id },
    data: {
      branchId: input.branchId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      type: input.type,
      creditLimit: input.creditLimit,
      notes: input.notes,
      status: input.status,
    },
  })
  const limitChanged = !dec(before.creditLimit).eq(after.creditLimit)
  const changes = [
    limitChanged && `credit limit ${money(num(before.creditLimit))} → ${money(num(after.creditLimit))}`,
    before.status !== after.status && after.status,
  ].filter(Boolean)
  await audit(ctx, {
    action: "update",
    entityType: "customer",
    entityId: id,
    summary: `Updated customer ${after.code} ${after.name}${changes.length ? ` (${changes.join(", ")})` : ""}`,
    before: customerProfile(before),
    after: customerProfile(after),
  })
  return customerDto(after)
}

/** Delete only customers without any trading history (opening entry aside); otherwise deactivate. */
export async function deleteCustomer(ctx: TenantContext, db: TenantDb, id: string) {
  const c = await getCustomer(db, id)
  const [activity, invoices, orders, receipts] = await Promise.all([
    db.customerLedgerEntry.count({ where: { customerId: id, type: { not: "opening" } } }),
    db.invoice.count({ where: { customerId: id } }),
    db.salesOrder.count({ where: { customerId: id } }),
    db.moneyReceipt.count({ where: { customerId: id } }),
  ])
  if (activity || invoices || orders || receipts)
    throw businessRule("This customer has invoices, payments or other ledger activity and cannot be deleted. Mark it inactive instead.")
  await prisma.$transaction(async (tx) => {
    await tx.customerLedgerEntry.deleteMany({ where: { customerId: id, companyId: ctx.companyId } })
    await tx.customer.delete({ where: { id } })
    await audit(ctx, { action: "delete", entityType: "customer", entityId: id, summary: `Deleted customer ${c.code} ${c.name}`, before: customerProfile(c) }, tx)
  })
}

/** CRM-03: profile, stats, ledger, invoices and product-wise purchase history. */
export async function getCustomerDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const c = await getCustomer(db, id)
  const scope = { customerId: id, branchId: { in: ctx.branchIds } }
  const [ledgerDesc, ledgerCount, invoices, totals, lines, homeBranch] = await Promise.all([
    db.customerLedgerEntry.findMany({ where: { customerId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 }),
    db.customerLedgerEntry.count({ where: { customerId: id } }),
    db.invoice.findMany({ where: scope, orderBy: { invoiceDate: "desc" }, take: 200 }),
    db.invoice.aggregate({ where: { ...scope, status: { not: "cancelled" } }, _sum: { total: true, returnedAmount: true }, _count: true }),
    prisma.invoiceLine.findMany({
      where: { invoice: { companyId: ctx.companyId, ...scope, status: { notIn: ["cancelled", "draft"] } } },
      select: {
        variationId: true,
        quantity: true,
        returnedQty: true,
        lineTotal: true,
        invoice: { select: { invoiceDate: true } },
      },
    }),
    c.branchId ? db.branch.findFirst({ where: { id: c.branchId }, select: { name: true } }) : Promise.resolve(null),
  ])

  // product-wise purchase history (customer product-wise report)
  const byVariation = new Map<string, { qty: Prisma.Decimal; returned: Prisma.Decimal; amount: Prisma.Decimal; last: Date; invoices: number }>()
  for (const l of lines) {
    const g = byVariation.get(l.variationId) ?? { qty: dec(0), returned: dec(0), amount: dec(0), last: l.invoice.invoiceDate, invoices: 0 }
    g.qty = g.qty.plus(l.quantity)
    g.returned = g.returned.plus(l.returnedQty)
    g.amount = g.amount.plus(l.lineTotal)
    g.invoices += 1
    if (l.invoice.invoiceDate > g.last) g.last = l.invoice.invoiceDate
    byVariation.set(l.variationId, g)
  }
  const variations = byVariation.size
    ? await db.productVariation.findMany({
        where: { id: { in: [...byVariation.keys()] } },
        select: { id: true, name: true, sku: true, product: { select: { id: true, name: true, unit: true } } },
      })
    : []
  const vMap = new Map(variations.map((v) => [v.id, v]))
  const products = [...byVariation.entries()]
    .map(([variationId, g]) => {
      const v = vMap.get(variationId)
      return {
        variationId,
        productId: v?.product.id ?? null,
        productName: v?.product.name ?? "Deleted product",
        variationName: v?.name ?? "—",
        sku: v?.sku ?? "",
        unit: v?.product.unit ?? "",
        quantity: num(g.qty),
        returnedQty: num(g.returned),
        amount: num(g.amount),
        invoices: g.invoices,
        lastPurchase: g.last.toISOString(),
      }
    })
    .sort((a, b) => b.amount - a.amount)

  const totalPurchases = num(dec(totals._sum.total).minus(dec(totals._sum.returnedAmount)))
  return {
    customer: { ...customerProfile(c), branchName: homeBranch?.name ?? null },
    stats: {
      outstanding: num(c.balance),
      creditLimit: num(c.creditLimit),
      totalPurchases,
      invoiceCount: totals._count,
      productsBought: products.length,
      totalQty: num(sum(lines.map((l) => l.quantity))),
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
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      date: i.invoiceDate.toISOString(),
      type: i.type,
      status: i.status,
      total: num(i.total),
      paid: num(i.paidAmount),
      due: num(i.dueAmount),
    })),
    products,
  }
}
export type CustomerDetail = Awaited<ReturnType<typeof getCustomerDetail>>
