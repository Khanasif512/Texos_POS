import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"
import { computePnl, dbDate, n2, pnlByPeriod, rangeBounds, type PeriodAgg } from "./calc"

/**
 * FIN-02 shared semantics:
 *   Revenue = Σ Invoice.total (not cancelled, by invoiceDate) − Σ approved SalesReturn.totalAmount (by approvedAt)
 *   COGS    = Σ Invoice.costTotal − Σ approved SalesReturn.costAmount
 *   Opex    = Σ Expense.amount where allocateToLc = false (LC-allocated expenses are capitalised into landed cost)
 */
type Scope = { companyId: string; branchIds: string[]; from: string; to: string }

export type PnlStatement = {
  invoiceCount: number
  returnCount: number
  sales: number
  returns: number
  netRevenue: number
  cogs: number
  grossProfit: number
  grossMargin: number | null
  expenses: { categoryId: string; name: string; amount: number }[]
  operatingExpenses: number
  netProfit: number
  netMargin: number | null
  /** expenses capitalised into LC landed cost (excluded from opex) */
  lcAllocatedExpenses: number
}

export async function pnlStatement(s: Scope): Promise<PnlStatement> {
  if (!s.branchIds.length) return emptyStatement()
  const range = rangeBounds(s.from, s.to)
  const branchId = { in: s.branchIds }
  const [inv, ret, exp, lcAllocated] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId: s.companyId, branchId, status: { not: "cancelled" }, invoiceDate: range },
      _sum: { total: true, costTotal: true },
      _count: { _all: true },
    }),
    prisma.salesReturn.aggregate({
      where: { companyId: s.companyId, branchId, status: "approved", approvedAt: range },
      _sum: { totalAmount: true, costAmount: true },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { companyId: s.companyId, branchId, allocateToLc: false, date: { gte: dbDate(s.from), lte: dbDate(s.to) } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId: s.companyId, branchId, allocateToLc: true, date: { gte: dbDate(s.from), lte: dbDate(s.to) } },
      _sum: { amount: true },
    }),
  ])
  const cats = exp.length
    ? await prisma.expenseCategory.findMany({ where: { companyId: s.companyId, id: { in: exp.map((e) => e.categoryId) } }, select: { id: true, name: true } })
    : []
  const name = new Map(cats.map((c) => [c.id, c.name]))
  const p = computePnl({
    sales: inv._sum.total?.toString(),
    salesCost: inv._sum.costTotal?.toString(),
    returns: ret._sum.totalAmount?.toString(),
    returnsCost: ret._sum.costAmount?.toString(),
    expenses: exp.map((e) => ({ key: e.categoryId, name: name.get(e.categoryId) ?? "—", amount: e._sum.amount?.toString() })),
  })
  return {
    invoiceCount: inv._count._all,
    returnCount: ret._count._all,
    sales: n2(p.sales),
    returns: n2(p.returns),
    netRevenue: n2(p.netRevenue),
    cogs: n2(p.cogs),
    grossProfit: n2(p.grossProfit),
    grossMargin: p.grossMargin,
    expenses: p.expenses.map((e) => ({ categoryId: e.key, name: e.name, amount: n2(e.amount) })),
    operatingExpenses: n2(p.operatingExpenses),
    netProfit: n2(p.netProfit),
    netMargin: p.netMargin,
    lcAllocatedExpenses: num(lcAllocated._sum.amount),
  }
}
function emptyStatement(): PnlStatement {
  return {
    invoiceCount: 0,
    returnCount: 0,
    sales: 0,
    returns: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMargin: null,
    expenses: [],
    operatingExpenses: 0,
    netProfit: 0,
    netMargin: null,
    lcAllocatedExpenses: 0,
  }
}

/** Minutes east of UTC for the business day (timestamps are stored in UTC). */
const tzOffsetMinutes = () => -new Date().getTimezoneOffset()

type Raw = { k: string; a: unknown; b: unknown }

/**
 * Aggregates invoices, approved returns and operating expenses per period key
 * ('%Y-%m' for months, '%Y-%m-%d' for days) in the database.
 */
export async function periodAggregates(s: Scope, granularity: "day" | "month", opts: { salesOnly?: boolean } = {}): Promise<PeriodAgg[]> {
  if (!s.branchIds.length) return []
  const fmt = granularity === "month" ? "%Y-%m" : "%Y-%m-%d"
  const off = tzOffsetMinutes()
  const range = rangeBounds(s.from, s.to)
  const branches = Prisma.join(s.branchIds)
  const invoices = prisma.$queryRaw<Raw[]>`
    SELECT DATE_FORMAT(DATE_ADD(invoiceDate, INTERVAL ${off} MINUTE), ${fmt}) AS k, SUM(total) AS a, SUM(costTotal) AS b
    FROM invoices
    WHERE companyId = ${s.companyId} AND branchId IN (${branches}) AND status <> 'cancelled'
      AND invoiceDate >= ${range.gte} AND invoiceDate < ${range.lt}
    GROUP BY k`
  const returns = opts.salesOnly
    ? Promise.resolve([] as Raw[])
    : prisma.$queryRaw<Raw[]>`
    SELECT DATE_FORMAT(DATE_ADD(approvedAt, INTERVAL ${off} MINUTE), ${fmt}) AS k, SUM(totalAmount) AS a, SUM(costAmount) AS b
    FROM sales_returns
    WHERE companyId = ${s.companyId} AND branchId IN (${branches}) AND status = 'approved'
      AND approvedAt >= ${range.gte} AND approvedAt < ${range.lt}
    GROUP BY k`
  const expenses = opts.salesOnly
    ? Promise.resolve([] as Raw[])
    : prisma.$queryRaw<Raw[]>`
    SELECT DATE_FORMAT(date, ${fmt}) AS k, SUM(amount) AS a, 0 AS b
    FROM expenses
    WHERE companyId = ${s.companyId} AND branchId IN (${branches}) AND allocateToLc = 0
      AND date >= ${s.from} AND date <= ${s.to}
    GROUP BY k`
  const [i, r, e] = await Promise.all([invoices, returns, expenses])
  const str = (v: unknown) => (v == null ? "0" : String(v))
  return [
    ...i.map((x) => ({ key: x.k, sales: str(x.a), salesCost: str(x.b) })),
    ...r.map((x) => ({ key: x.k, returns: str(x.a), returnsCost: str(x.b) })),
    ...e.map((x) => ({ key: x.k, expenses: str(x.a) })),
  ]
}

export async function pnlPeriods(s: Scope, granularity: "day" | "month", keys: string[]) {
  return pnlByPeriod(keys, await periodAggregates(s, granularity))
}

/** FIN-02 "by branch": one P&L line per branch for the period. */
export async function pnlByBranch(s: Scope, branches: { id: string; name: string }[]) {
  if (!s.branchIds.length) return []
  const range = rangeBounds(s.from, s.to)
  const branchId = { in: s.branchIds }
  const [inv, ret, exp] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["branchId"],
      where: { companyId: s.companyId, branchId, status: { not: "cancelled" }, invoiceDate: range },
      _sum: { total: true, costTotal: true },
    }),
    prisma.salesReturn.groupBy({
      by: ["branchId"],
      where: { companyId: s.companyId, branchId, status: "approved", approvedAt: range },
      _sum: { totalAmount: true, costAmount: true },
    }),
    prisma.expense.groupBy({
      by: ["branchId"],
      where: { companyId: s.companyId, branchId, allocateToLc: false, date: { gte: dbDate(s.from), lte: dbDate(s.to) } },
      _sum: { amount: true },
    }),
  ])
  const rows: PeriodAgg[] = [
    ...inv.map((x) => ({ key: x.branchId, sales: x._sum.total?.toString(), salesCost: x._sum.costTotal?.toString() })),
    ...ret.map((x) => ({ key: x.branchId, returns: x._sum.totalAmount?.toString(), returnsCost: x._sum.costAmount?.toString() })),
    ...exp.map((x) => ({ key: x.branchId, expenses: x._sum.amount?.toString() })),
  ]
  const ids = branches.filter((b) => s.branchIds.includes(b.id))
  const name = new Map(ids.map((b) => [b.id, b.name]))
  return pnlByPeriod(
    ids.map((b) => b.id),
    rows,
  ).map((r) => ({ ...r, branchId: r.key, branchName: name.get(r.key) ?? "—" }))
}
