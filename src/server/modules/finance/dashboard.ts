import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { can, type TenantContext } from "@/server/auth/context"
import { num } from "@/server/decimal"
import { addDays, computeCashDay, dayBounds, dayKey, dbDate, monthKey, monthRange, n2, openingCashFor, total } from "./calc"
import { cashDayTotals } from "./cash-closing"
import { periodAggregates, pnlStatement } from "./pnl"

/**
 * Dashboard data for the user's permitted branches. Every block is only computed when the
 * role may see it (null otherwise), so the page simply hides what is null.
 */
export async function dashboardData(ctx: TenantContext) {
  const companyId = ctx.companyId
  const branchIds = ctx.branchIds
  const today = dayKey(new Date())
  const month = monthRange(monthKey(new Date()))
  const from30 = addDays(today, -29)

  const perms = {
    sales: can(ctx, "sales.view"),
    cost: can(ctx, "inventory.view_cost"),
    receivables: can(ctx, "customers.view") || can(ctx, "sales.receipt"),
    cash: can(ctx, "finance.cash_closing") || can(ctx, "finance.view"),
    inventory: can(ctx, "inventory.view"),
    lc: can(ctx, "lc.view") && ctx.plan.features.lc,
    returns: can(ctx, "sales.view") || can(ctx, "sales.return_approve"),
    expenses: can(ctx, "expenses.view"),
  }
  const hasBranches = branchIds.length > 0
  const branchIn = Prisma.join(hasBranches ? branchIds : ["-"])

  const todayPnl = perms.sales && hasBranches ? pnlStatement({ companyId, branchIds, from: today, to: today }) : null

  const receivables = perms.receivables
    ? prisma.customer.aggregate({
        where: { companyId, balance: { gt: 0 }, ...(ctx.allBranches ? {} : { branchId: { in: branchIds } }) },
        _sum: { balance: true },
        _count: { _all: true },
      })
    : null

  const cash = perms.cash
    ? Promise.all(
        branchIds.map(async (branchId) => {
          const closed = await prisma.cashClosing.findFirst({ where: { companyId, branchId, date: dbDate(today) }, select: { countedCash: true } })
          if (closed) return { amount: num(closed.countedCash), closed: true }
          const t = await cashDayTotals(prisma, companyId, branchId, today)
          const r = computeCashDay({ ...t, openingCash: openingCashFor(t.previous).openingCash })
          return { amount: n2(r.expectedClosing), closed: false }
        }),
      )
    : null

  const salesSeries = perms.sales ? periodAggregates({ companyId, branchIds, from: from30, to: today }, "day", { salesOnly: true }) : null

  const topItems =
    perms.sales && hasBranches
      ? prisma.$queryRaw<{ id: string; qty: unknown; amount: unknown }[]>`
          SELECT il.variationId AS id, SUM(il.quantity) AS qty, SUM(il.lineTotal) AS amount
          FROM invoice_lines il JOIN invoices i ON i.id = il.invoiceId
          WHERE i.companyId = ${companyId} AND i.branchId IN (${branchIn}) AND i.status <> 'cancelled'
            AND i.invoiceDate >= ${dayBounds(month.from).gte} AND i.invoiceDate < ${dayBounds(month.to).lt}
          GROUP BY il.variationId ORDER BY amount DESC LIMIT 5`
      : null

  const recent = perms.sales
    ? prisma.invoice.findMany({
        where: { companyId, branchId: { in: branchIds } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, number: true, customerName: true, total: true, dueAmount: true, status: true, type: true, invoiceDate: true },
      })
    : null

  const lowStock =
    perms.inventory && hasBranches
      ? prisma.$queryRaw<{ n: unknown }[]>`
          SELECT COUNT(*) AS n FROM stock_balances sb JOIN product_variations pv ON pv.id = sb.variationId
          WHERE sb.companyId = ${companyId} AND sb.branchId IN (${branchIn}) AND pv.status = 'active'
            AND pv.reorderLevel > 0 AND sb.quantity <= pv.reorderLevel`
      : null

  const lcs = perms.lc
    ? Promise.all([
        prisma.lc.count({ where: { companyId, branchId: { in: branchIds }, status: "goods_in_transit" } }),
        prisma.lc.findMany({
          where: {
            companyId,
            branchId: { in: branchIds },
            status: { in: ["opened", "goods_in_transit"] },
            expectedArrivalDate: { gte: dbDate(today), lte: dbDate(addDays(today, 7)) },
          },
          orderBy: { expectedArrivalDate: "asc" },
          take: 5,
          select: { id: true, lcNumber: true, status: true, expectedArrivalDate: true, supplier: { select: { name: true } } },
        }),
      ])
    : null

  const pendingReturns = perms.returns ? prisma.salesReturn.count({ where: { companyId, branchId: { in: branchIds }, status: "pending" } }) : null

  const todayExpenses = perms.expenses
    ? prisma.expense.aggregate({ where: { companyId, branchId: { in: branchIds }, date: dbDate(today) }, _sum: { amount: true }, _count: { _all: true } })
    : null

  const [pnl, rec, cashRows, series, top, recentRows, low, lcData, pending, exp] = await Promise.all([
    todayPnl,
    receivables,
    cash,
    salesSeries,
    topItems,
    recent,
    lowStock,
    lcs,
    pendingReturns,
    todayExpenses,
  ])

  const variations = top?.length
    ? await prisma.productVariation.findMany({
        where: { companyId, id: { in: top.map((t) => t.id) } },
        select: { id: true, name: true, sku: true, product: { select: { name: true, unit: true } } },
      })
    : []
  const vMap = new Map(variations.map((v) => [v.id, v]))

  const byDay = new Map((series ?? []).map((s) => [s.key, s]))
  const chart = series
    ? Array.from({ length: 30 }, (_, i) => {
        const key = addDays(from30, i)
        const s = byDay.get(key)
        return { date: key, sales: n2(s?.sales), profit: perms.cost ? n2(total([s?.sales]).minus(total([s?.salesCost]))) : null }
      })
    : null

  return {
    today,
    perms,
    sales: pnl ? { amount: pnl.sales, net: pnl.netRevenue, invoices: pnl.invoiceCount } : null,
    grossProfit: pnl && perms.cost ? { amount: pnl.grossProfit, margin: pnl.grossMargin } : null,
    receivables: rec ? { amount: num(rec._sum.balance), customers: rec._count._all } : null,
    cashInHand: cashRows
      ? { amount: n2(total(cashRows.map((c) => c.amount))), closedBranches: cashRows.filter((c) => c.closed).length, branches: cashRows.length }
      : null,
    expensesToday: exp ? { amount: num(exp._sum.amount), count: exp._count._all } : null,
    chart,
    chartTotal: series ? n2(total(series.map((x) => x.sales))) : 0,
    topItems: top
      ? top.map((t) => {
          const v = vMap.get(t.id)
          return {
            id: t.id,
            name: v ? `${v.product.name} — ${v.name}` : "Unknown item",
            sku: v?.sku ?? "",
            unit: v?.product.unit ?? "",
            qty: Number(t.qty ?? 0),
            amount: Number(t.amount ?? 0),
          }
        })
      : null,
    recentInvoices: recentRows
      ? recentRows.map((r) => ({
          id: r.id,
          number: r.number,
          customer: r.customerName ?? "Walk-in customer",
          total: num(r.total),
          due: num(r.dueAmount),
          status: r.status,
          type: r.type,
          date: r.invoiceDate.toISOString(),
        }))
      : null,
    lowStock: low ? Number(low[0]?.n ?? 0) : null,
    lcs: lcData
      ? {
          inTransit: lcData[0],
          arriving: lcData[1].map((l) => ({
            id: l.id,
            lcNumber: l.lcNumber,
            status: l.status,
            supplier: l.supplier.name,
            expected: l.expectedArrivalDate ? l.expectedArrivalDate.toISOString().slice(0, 10) : null,
          })),
        }
      : null,
    pendingReturns: pending,
  }
}
export type DashboardData = Awaited<ReturnType<typeof dashboardData>>
