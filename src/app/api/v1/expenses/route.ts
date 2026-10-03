import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createExpense } from "@/server/modules/finance/expenses"
import { listExpenses } from "@/server/modules/finance/queries"
import { expenseSchema } from "@/lib/validation/finance"

/** GET /api/v1/expenses?page&limit&sort&q&from&to&branchId&categoryId&lc=linked|allocated|none&lcId */
export const GET = tenantRoute({ perm: "expenses.view" }, async ({ req, ctx }) => {
  const p = listParams(req, ["date", "amount", "number", "createdAt"], "date:desc")
  const data = await listExpenses(ctx, {
    q: p.q,
    branchId: p.branchId,
    from: p.from,
    to: p.to,
    categoryId: p.sp.get("categoryId") ?? undefined,
    lc: p.sp.get("lc") ?? undefined,
    lcId: p.sp.get("lcId") ?? undefined,
    skip: p.skip,
    take: p.limit,
    orderBy: p.orderBy,
  })
  return ok(data.rows, { meta: { page: p.page, limit: p.limit, total: data.total, totals: data.totals } })
})

export const POST = tenantRoute({ perm: "expenses.create" }, async ({ req, ctx }) => {
  const res = await createExpense(ctx, await parseBody(req, expenseSchema))
  return ok(res, { status: 201, message: `Expense ${res.number} recorded` })
})
