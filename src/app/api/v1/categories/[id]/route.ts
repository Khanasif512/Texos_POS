import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { deleteCategory, updateCategory } from "@/server/modules/products/service"
import { categorySchema } from "@/lib/validation/products"

export const PATCH = tenantRoute({ perm: "inventory.update" }, async ({ req, ctx, db, params }) => {
  const c = await updateCategory(ctx, db, params.id, await parseBody(req, categorySchema))
  return ok(c, { message: "Category updated" })
})

export const DELETE = tenantRoute({ perm: "inventory.delete" }, async ({ ctx, db, params }) => {
  await deleteCategory(ctx, db, params.id)
  return ok({ id: params.id }, { message: "Category deleted" })
})
