import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createCategory } from "@/server/modules/finance/expenses"
import { expenseCategorySchema } from "@/lib/validation/finance"

/** GET /api/v1/expense-categories?active=1 */
export const GET = tenantRoute({ perm: ["expenses.view", "expenses.create", "delivery.manage", "lc.update"] }, async ({ req, db }) => {
  const active = new URL(req.url).searchParams.get("active")
  const rows = await db.expenseCategory.findMany({
    where: active ? { status: "active" } : {},
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { expenses: true } } },
  })
  return ok(rows.map(({ _count, ...c }) => ({ ...c, expenseCount: _count.expenses })))
})

export const POST = tenantRoute({ perm: "expenses.update" }, async ({ req, ctx, db }) => {
  const cat = await createCategory(ctx, db, await parseBody(req, expenseCategorySchema))
  return ok(cat, { status: 201, message: "Category created" })
})
