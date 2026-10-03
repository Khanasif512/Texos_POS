import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { AppError, forbidden } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, type TenantContext } from "@/server/auth/context"
import { num } from "@/server/decimal"
import type { CashClosingOutput } from "@/lib/validation/finance"
import { computeCashDay, dayBounds, dayKey, dbDate, dbDateKey, n2, openingCashFor, total } from "./calc"

type Client = typeof prisma | Prisma.TransactionClient

/**
 * Shared semantics (FIN-01, EXP-03) for one branch and one business day:
 * - cash sales    = Σ Invoice.paidAmount  (type cash, paymentMethod cash, not cancelled, by invoiceDate)
 * - cash receipts = Σ MoneyReceipt.amount (method cash, not cancelled, by date)
 * - cash expenses = Σ Expense.amount      (method cash, by date)
 * - cash payouts  = Σ SupplierPayment.amount (method cash, by date) + Σ SalesReturn.totalAmount (approved, refund cash, by approvedAt)
 */
function dayWhere(companyId: string, branchId: string, key: string) {
  const day = dayBounds(key)
  return {
    invoice: { companyId, branchId, type: "cash", paymentMethod: "cash", status: { not: "cancelled" }, invoiceDate: day } satisfies Prisma.InvoiceWhereInput,
    receipt: { companyId, branchId, method: "cash", cancelledAt: null, date: day } satisfies Prisma.MoneyReceiptWhereInput,
    expense: { companyId, branchId, method: "cash", date: dbDate(key) } satisfies Prisma.ExpenseWhereInput,
    payment: { companyId, branchId, method: "cash", date: day } satisfies Prisma.SupplierPaymentWhereInput,
    refund: { companyId, branchId, status: "approved", refundMode: "cash", approvedAt: day } satisfies Prisma.SalesReturnWhereInput,
  }
}

/** Totals only — used by close-day (inside the transaction) and the dashboard. */
export async function cashDayTotals(db: Client, companyId: string, branchId: string, key: string) {
  const w = dayWhere(companyId, branchId, key)
  // sequential on purpose: also runs inside interactive transactions (one connection)
  const sales = await db.invoice.aggregate({ where: w.invoice, _sum: { paidAmount: true } })
  const receipts = await db.moneyReceipt.aggregate({ where: w.receipt, _sum: { amount: true } })
  const expenses = await db.expense.aggregate({ where: w.expense, _sum: { amount: true } })
  const payments = await db.supplierPayment.aggregate({ where: w.payment, _sum: { amount: true } })
  const refunds = await db.salesReturn.aggregate({ where: w.refund, _sum: { totalAmount: true } })
  const previous = await db.cashClosing.findFirst({ where: { companyId, branchId, date: { lt: dbDate(key) } }, orderBy: { date: "desc" } })
  return {
    cashSales: sales._sum.paidAmount,
    cashReceipts: receipts._sum.amount,
    cashExpenses: expenses._sum.amount,
    cashPayouts: total([payments._sum.amount, refunds._sum.totalAmount]),
    previous,
  }
}

/** Everything the cash-closing screen needs for a branch/day: live figures, stored closing, breakdown, expense summary. */
export async function cashDayReport(ctx: TenantContext, branchId: string, key: string) {
  assertBranch(ctx, branchId)
  const companyId = ctx.companyId
  const w = dayWhere(companyId, branchId, key)
  const [totals, existing, invoices, receipts, expenses, payments, refunds, allExpenses, branch] = await Promise.all([
    cashDayTotals(prisma, companyId, branchId, key),
    prisma.cashClosing.findFirst({ where: { companyId, branchId, date: dbDate(key) } }),
    prisma.invoice.findMany({
      where: w.invoice,
      orderBy: { invoiceDate: "asc" },
      take: 500,
      select: { id: true, number: true, customerName: true, paidAmount: true, invoiceDate: true },
    }),
    prisma.moneyReceipt.findMany({
      where: w.receipt,
      orderBy: { date: "asc" },
      take: 500,
      select: { id: true, number: true, customerId: true, amount: true, date: true, reference: true },
    }),
    prisma.expense.findMany({
      where: w.expense,
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, number: true, amount: true, description: true, category: { select: { name: true } } },
    }),
    prisma.supplierPayment.findMany({
      where: w.payment,
      orderBy: { date: "asc" },
      take: 500,
      select: { id: true, number: true, amount: true, reference: true, supplier: { select: { name: true } } },
    }),
    prisma.salesReturn.findMany({
      where: w.refund,
      orderBy: { approvedAt: "asc" },
      take: 500,
      select: { id: true, number: true, totalAmount: true, invoiceId: true },
    }),
    prisma.expense.groupBy({ by: ["categoryId", "method"], where: { companyId, branchId, date: dbDate(key) }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.branch.findFirst({ where: { id: branchId, companyId }, select: { id: true, name: true, code: true } }),
  ])

  const customerIds = [...new Set(receipts.map((r) => r.customerId).filter(Boolean) as string[])]
  const categoryIds = [...new Set(allExpenses.map((e) => e.categoryId))]
  const [customers, categories, closedBy] = await Promise.all([
    customerIds.length ? prisma.customer.findMany({ where: { companyId, id: { in: customerIds } }, select: { id: true, name: true } }) : [],
    categoryIds.length ? prisma.expenseCategory.findMany({ where: { companyId, id: { in: categoryIds } }, select: { id: true, name: true } }) : [],
    existing?.closedById ? prisma.user.findFirst({ where: { id: existing.closedById, companyId }, select: { name: true } }) : null,
  ])
  const cName = new Map(customers.map((c) => [c.id, c.name]))
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  const { openingCash, isFirst } = openingCashFor(totals.previous, existing?.openingCash)
  const live = computeCashDay({ ...totals, openingCash })

  const summary = new Map<string, { categoryId: string; name: string; cash: number; other: number; total: number; count: number }>()
  for (const g of allExpenses) {
    const row = summary.get(g.categoryId) ?? { categoryId: g.categoryId, name: catName.get(g.categoryId) ?? "—", cash: 0, other: 0, total: 0, count: 0 }
    const amt = num(g._sum.amount)
    if (g.method === "cash") row.cash = n2(total([row.cash, amt]))
    else row.other = n2(total([row.other, amt]))
    row.total = n2(total([row.cash, row.other]))
    row.count += g._count._all
    summary.set(g.categoryId, row)
  }

  return {
    branch,
    date: key,
    isFirst,
    previous: totals.previous ? { date: dbDateKey(totals.previous.date), countedCash: num(totals.previous.countedCash) } : null,
    figures: {
      openingCash: n2(live.openingCash),
      cashSales: n2(live.cashSales),
      cashReceipts: n2(live.cashReceipts),
      cashExpenses: n2(live.cashExpenses),
      cashPayouts: n2(live.cashPayouts),
      expectedClosing: n2(live.expectedClosing),
    },
    closing: existing
      ? {
          id: existing.id,
          openingCash: num(existing.openingCash),
          cashSales: num(existing.cashSales),
          cashReceipts: num(existing.cashReceipts),
          cashExpenses: num(existing.cashExpenses),
          cashPayouts: num(existing.cashPayouts),
          expectedClosing: num(existing.expectedClosing),
          countedCash: num(existing.countedCash),
          difference: num(existing.difference),
          note: existing.note,
          closedBy: closedBy?.name ?? null,
          closedAt: existing.createdAt.toISOString(),
          /** live figures moved since the day was closed (late entry / owner edit) */
          stale: !live.expectedClosing.equals(existing.expectedClosing.toString()),
        }
      : null,
    breakdown: {
      sales: invoices.map((i) => ({ id: i.id, number: i.number, party: i.customerName ?? "Walk-in customer", amount: num(i.paidAmount), at: i.invoiceDate.toISOString() })),
      receipts: receipts.map((r) => ({
        id: r.id,
        number: r.number,
        party: (r.customerId && cName.get(r.customerId)) || "—",
        amount: num(r.amount),
        at: r.date.toISOString(),
        reference: r.reference,
      })),
      expenses: expenses.map((e) => ({ id: e.id, number: e.number, party: e.category.name, description: e.description, amount: num(e.amount) })),
      payouts: [
        ...payments.map((p) => ({ id: p.id, number: p.number, kind: "Supplier payment", party: p.supplier.name, amount: num(p.amount) })),
        ...refunds.map((r) => ({ id: r.id, number: r.number, kind: "Cash refund", party: "Sales return", amount: num(r.totalAmount) })),
      ],
    },
    expenseSummary: [...summary.values()].sort((a, b) => b.total - a.total),
  }
}
export type CashDayReport = Awaited<ReturnType<typeof cashDayReport>>

/** FIN-01: save the closing (unique per branch/day). Re-closing an already closed day is owner-only and audited. */
export async function closeCashDay(ctx: TenantContext, input: CashClosingOutput) {
  assertBranch(ctx, input.branchId)
  if (input.date > dayKey(new Date())) throw new AppError("VALIDATION_ERROR", "You cannot close a future day", { fields: { date: "Future date" } })
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, companyId: ctx.companyId }, select: { id: true, name: true } })
    if (!branch) throw new AppError("VALIDATION_ERROR", "Choose a valid branch", { fields: { branchId: "Invalid branch" } })
    const existing = await tx.cashClosing.findFirst({ where: { companyId: ctx.companyId, branchId: branch.id, date: dbDate(input.date) } })
    if (existing && !ctx.isOwner) throw forbidden("This day is already closed. Only the owner can re-close it.")

    const totals = await cashDayTotals(tx, ctx.companyId, branch.id, input.date)
    const { openingCash } = openingCashFor(totals.previous, input.openingCash ?? existing?.openingCash ?? 0)
    const r = computeCashDay({ ...totals, openingCash, countedCash: input.countedCash })
    const data = {
      openingCash: r.openingCash.toFixed(2),
      cashSales: r.cashSales.toFixed(2),
      cashReceipts: r.cashReceipts.toFixed(2),
      cashExpenses: r.cashExpenses.toFixed(2),
      cashPayouts: r.cashPayouts.toFixed(2),
      expectedClosing: r.expectedClosing.toFixed(2),
      countedCash: r.countedCash!.toFixed(2),
      difference: r.difference!.toFixed(2),
      note: input.note,
      closedById: ctx.userId,
    }
    const saved = existing
      ? await tx.cashClosing.update({ where: { id: existing.id }, data })
      : await tx.cashClosing.create({ data: { ...data, companyId: ctx.companyId, branchId: branch.id, date: dbDate(input.date) } })
    const diff = r.difference!
    const verdict = diff.isZero() ? "balanced" : `${diff.isPositive() ? "over" : "short"} ৳${diff.abs().toFixed(2)}`
    await audit(
      ctx,
      {
        action: existing ? "update" : "create",
        entityType: "cash_closing",
        entityId: saved.id,
        summary: `${existing ? "Re-closed" : "Closed"} cash for ${branch.name} on ${input.date}: counted ৳${data.countedCash} (${verdict})`,
        before: existing ? { ...existing, date: input.date } : undefined,
        after: { ...data, date: input.date, branchId: branch.id },
      },
      tx,
    )
    return { id: saved.id, reclosed: !!existing, expectedClosing: num(data.expectedClosing), difference: num(data.difference) }
  })
}

/** History of closings (newest first) for permitted branches. */
export async function closingHistory(ctx: TenantContext, branchId?: string | null, limit = 30) {
  if (branchId) assertBranch(ctx, branchId)
  const rows = await prisma.cashClosing.findMany({
    where: { companyId: ctx.companyId, branchId: branchId ? branchId : { in: ctx.branchIds } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  })
  const userIds = [...new Set(rows.map((r) => r.closedById).filter(Boolean) as string[])]
  const users = userIds.length ? await prisma.user.findMany({ where: { companyId: ctx.companyId, id: { in: userIds } }, select: { id: true, name: true } }) : []
  const uName = new Map(users.map((u) => [u.id, u.name]))
  const bName = new Map(ctx.branches.map((b) => [b.id, b.name]))
  return rows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: bName.get(r.branchId) ?? "—",
    date: dbDateKey(r.date),
    openingCash: num(r.openingCash),
    cashIn: num(total([r.cashSales, r.cashReceipts])),
    cashOut: num(total([r.cashExpenses, r.cashPayouts])),
    expectedClosing: num(r.expectedClosing),
    countedCash: num(r.countedCash),
    difference: num(r.difference),
    note: r.note,
    closedBy: (r.closedById && uName.get(r.closedById)) || null,
  }))
}
export type ClosingHistoryRow = Awaited<ReturnType<typeof closingHistory>>[number]
