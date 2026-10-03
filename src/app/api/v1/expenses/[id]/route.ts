import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { assertBranch } from "@/server/auth/context"
import { notFound } from "@/server/errors"
import { num } from "@/server/decimal"
import { deleteExpense, updateExpense } from "@/server/modules/finance/expenses"
import { dbDateKey } from "@/server/modules/finance/calc"
import { expenseSchema } from "@/lib/validation/finance"

export const GET = tenantRoute({ perm: "expenses.view" }, async ({ ctx, db, params }) => {
  const e = await db.expense.findFirst({ where: { id: params.id }, include: { category: { select: { name: true } } } })
  if (!e) throw notFound("Expense")
  assertBranch(ctx, e.branchId)
  const lc = e.lcId ? await db.lc.findFirst({ where: { id: e.lcId }, select: { id: true, lcNumber: true, status: true } }) : null
  return ok({ ...e, amount: num(e.amount), date: dbDateKey(e.date), categoryName: e.category.name, lc })
})

export const PATCH = tenantRoute({ perm: "expenses.update" }, async ({ req, ctx, params }) => {
  const res = await updateExpense(ctx, params.id, await parseBody(req, expenseSchema))
  return ok(res, { message: "Expense updated" })
})

export const DELETE = tenantRoute({ perm: "expenses.delete" }, async ({ ctx, params }) => {
  await deleteExpense(ctx, params.id)
  return ok(null, { message: "Expense deleted" })
})
