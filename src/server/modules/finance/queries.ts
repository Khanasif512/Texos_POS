import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { branchFilter, type TenantContext } from "@/server/auth/context"
import { num } from "@/server/decimal"
import { dbDate, dbDateKey, isDayKey, n2, rangeBounds, total as sumOf } from "./calc"
import { deliveryCategory } from "./expenses"

export type ExpenseListParams = {
  q?: string
  branchId?: string
  categoryId?: string
  from?: string
  to?: string
  /** linked = has LC, allocated = capitalised to LC, none = no LC */
  lc?: string
  lcId?: string
  skip: number
  take: number
  orderBy: Record<string, "asc" | "desc">
}

export function expenseWhere(ctx: TenantContext, p: Omit<ExpenseListParams, "skip" | "take" | "orderBy">): Prisma.ExpenseWhereInput {
  const date: Prisma.DateTimeFilter = {}
  if (isDayKey(p.from)) date.gte = dbDate(p.from)
  if (isDayKey(p.to)) date.lte = dbDate(p.to)
  return {
    companyId: ctx.companyId,
    ...branchFilter(ctx, p.branchId),
    ...(p.categoryId && p.categoryId !== "all" ? { categoryId: p.categoryId } : {}),
    ...(date.gte || date.lte ? { date } : {}),
    ...(p.lc === "linked" ? { lcId: { not: null } } : p.lc === "allocated" ? { allocateToLc: true } : p.lc === "none" ? { lcId: null } : {}),
    ...(p.lcId ? { lcId: p.lcId } : {}),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { description: { contains: p.q } }, { reference: { contains: p.q } }] } : {}),
  }
}

export async function listExpenses(ctx: TenantContext, p: ExpenseListParams, extraWhere?: Prisma.ExpenseWhereInput) {
  const where = extraWhere ? { AND: [expenseWhere(ctx, p), extraWhere] } : expenseWhere(ctx, p)
  const [rows, count, sums] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [p.orderBy, { createdAt: "desc" }],
      skip: p.skip,
      take: p.take,
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({ by: ["allocateToLc", "method"], where, _sum: { amount: true } }),
  ])
  const lcIds = [...new Set(rows.map((r) => r.lcId).filter(Boolean) as string[])]
  const branchIds = [...new Set(rows.map((r) => r.branchId))]
  const [lcs, branches] = await Promise.all([
    lcIds.length ? prisma.lc.findMany({ where: { companyId: ctx.companyId, id: { in: lcIds } }, select: { id: true, lcNumber: true, status: true } }) : [],
    prisma.branch.findMany({ where: { companyId: ctx.companyId, id: { in: branchIds } }, select: { id: true, name: true, code: true } }),
  ])
  const lcMap = new Map(lcs.map((l) => [l.id, l]))
  const bMap = new Map(branches.map((b) => [b.id, b]))
  const sum = (f: (g: (typeof sums)[number]) => boolean) => n2(sumOf(sums.filter(f).map((g) => g._sum.amount)))
  return {
    total: count,
    totals: {
      amount: sum(() => true),
      cash: sum((g) => g.method === "cash"),
      allocated: sum((g) => g.allocateToLc),
      operating: sum((g) => !g.allocateToLc),
    },
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: dbDateKey(r.date),
      branchId: r.branchId,
      branchName: bMap.get(r.branchId)?.name ?? "—",
      categoryId: r.categoryId,
      categoryName: r.category.name,
      description: r.description,
      reference: r.reference,
      method: r.method,
      amount: num(r.amount),
      lcId: r.lcId,
      lcNumber: r.lcId ? (lcMap.get(r.lcId)?.lcNumber ?? null) : null,
      lcStatus: r.lcId ? (lcMap.get(r.lcId)?.status ?? null) : null,
      allocateToLc: r.allocateToLc,
    })),
  }
}
export type ExpenseRowView = Awaited<ReturnType<typeof listExpenses>>["rows"][number]

/** DLV-03: total delivery charges per LC (and per branch) for the filters. */
export async function deliveryTotalsByLc(ctx: TenantContext, p: { branchId?: string; from?: string; to?: string }) {
  const cat = await deliveryCategory(ctx.companyId)
  const where: Prisma.ExpenseWhereInput = { ...expenseWhere(ctx, p), categoryId: cat.id, lcId: { not: null } }
  const groups = await prisma.expense.groupBy({ by: ["lcId", "branchId"], where, _sum: { amount: true }, _count: { _all: true }, _max: { date: true } })
  const lcIds = [...new Set(groups.map((g) => g.lcId!))]
  const lcs = lcIds.length
    ? await prisma.lc.findMany({
        where: { companyId: ctx.companyId, id: { in: lcIds } },
        select: { id: true, lcNumber: true, status: true, supplier: { select: { name: true } } },
      })
    : []
  const lcMap = new Map(lcs.map((l) => [l.id, l]))
  const bName = new Map(ctx.branches.map((b) => [b.id, b.name]))
  const byLc = new Map<string, { lcId: string; lcNumber: string; status: string; supplier: string; count: number; amount: number; lastDate: string | null; branches: { name: string; amount: number }[] }>()
  for (const g of groups) {
    const l = lcMap.get(g.lcId!)
    const row = byLc.get(g.lcId!) ?? {
      lcId: g.lcId!,
      lcNumber: l?.lcNumber ?? "—",
      status: l?.status ?? "",
      supplier: l?.supplier.name ?? "—",
      count: 0,
      amount: 0,
      lastDate: null,
      branches: [],
    }
    const amt = num(g._sum.amount)
    row.count += g._count._all
    row.amount = n2(sumOf([row.amount, g._sum.amount]))
    const last = g._max.date ? dbDateKey(g._max.date) : null
    if (last && (!row.lastDate || last > row.lastDate)) row.lastDate = last
    row.branches.push({ name: bName.get(g.branchId) ?? "—", amount: amt })
    byLc.set(g.lcId!, row)
  }
  return [...byLc.values()].sort((a, b) => b.amount - a.amount)
}

/** Supplier payments list (FIN-03). */
export async function listSupplierPayments(
  ctx: TenantContext,
  p: { q?: string; branchId?: string; supplierId?: string; method?: string; from?: string; to?: string; skip: number; take: number; orderBy: Record<string, "asc" | "desc"> },
) {
  const where: Prisma.SupplierPaymentWhereInput = {
    companyId: ctx.companyId,
    ...branchFilter(ctx, p.branchId),
    ...(p.supplierId ? { supplierId: p.supplierId } : {}),
    ...(p.method && p.method !== "all" ? { method: p.method as Prisma.SupplierPaymentWhereInput["method"] } : {}),
    ...(isDayKey(p.from) || isDayKey(p.to)
      ? { date: rangeBounds(isDayKey(p.from) ? p.from : "2000-01-01", isDayKey(p.to) ? p.to : "2999-12-31") }
      : {}),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { reference: { contains: p.q } }, { supplier: { name: { contains: p.q } } }] } : {}),
  }
  const [rows, count, agg] = await Promise.all([
    prisma.supplierPayment.findMany({ where, orderBy: [p.orderBy, { createdAt: "desc" }], skip: p.skip, take: p.take, include: { supplier: { select: { name: true, code: true } } } }),
    prisma.supplierPayment.count({ where }),
    prisma.supplierPayment.aggregate({ where, _sum: { amount: true } }),
  ])
  const lcIds = [...new Set(rows.map((r) => r.lcId).filter(Boolean) as string[])]
  const lcs = lcIds.length ? await prisma.lc.findMany({ where: { companyId: ctx.companyId, id: { in: lcIds } }, select: { id: true, lcNumber: true } }) : []
  const lcMap = new Map(lcs.map((l) => [l.id, l.lcNumber]))
  const bName = new Map(ctx.branches.map((b) => [b.id, b.name]))
  return {
    total: count,
    sum: num(agg._sum.amount),
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date.toISOString(),
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      branchName: bName.get(r.branchId) ?? "—",
      method: r.method,
      reference: r.reference,
      note: r.note,
      lcNumber: r.lcId ? (lcMap.get(r.lcId) ?? null) : null,
      amount: num(r.amount),
    })),
  }
}
export type SupplierPaymentRowView = Awaited<ReturnType<typeof listSupplierPayments>>["rows"][number]
