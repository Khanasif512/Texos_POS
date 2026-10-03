import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createCategory, listCategories } from "@/server/modules/products/service"
import { categorySchema } from "@/lib/validation/products"

export const GET = tenantRoute({ perm: "inventory.view" }, async ({ db }) => ok(await listCategories(db)))

export const POST = tenantRoute({ perm: ["inventory.create", "inventory.update"] }, async ({ req, ctx, db }) => {
  const c = await createCategory(ctx, db, await parseBody(req, categorySchema))
  return ok(c, { status: 201, message: "Category created" })
})
