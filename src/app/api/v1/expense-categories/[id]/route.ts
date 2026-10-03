import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { deleteCategory, updateCategory } from "@/server/modules/finance/expenses"
import { expenseCategorySchema } from "@/lib/validation/finance"

export const PATCH = tenantRoute({ perm: "expenses.update" }, async ({ req, ctx, db, params }) => {
  const cat = await updateCategory(ctx, db, params.id, await parseBody(req, expenseCategorySchema))
  return ok(cat, { message: "Category updated" })
})

export const DELETE = tenantRoute({ perm: ["expenses.delete", "expenses.update"] }, async ({ ctx, db, params }) => {
  await deleteCategory(ctx, db, params.id)
  return ok(null, { message: "Category deleted" })
})
