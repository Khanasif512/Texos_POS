import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { deleteProduct, getProductDetail, updateProduct } from "@/server/modules/products/service"
import { productSchema } from "@/lib/validation/products"

/** Product with variations, stock per branch and (with inventory.view_cost) average available cost. */
export const GET = tenantRoute({ perm: "inventory.view" }, async ({ ctx, db, params }) => ok(await getProductDetail(ctx, db, params.id)))

/**
 * Full replace of the product and its variations: rows with `id` are updated, rows without are created,
 * missing rows are deleted (only when they have no stock or history).
 */
export const PATCH = tenantRoute({ perm: "inventory.update" }, async ({ req, ctx, db, params }) => {
  const input = await parseBody(req, productSchema)
  return idempotent(req, ctx.companyId, "products.update", async () => ({
    data: await updateProduct(ctx, db, params.id, input),
    message: "Product updated",
  }))
})

export const DELETE = tenantRoute({ perm: "inventory.delete" }, async ({ ctx, db, params }) => {
  await deleteProduct(ctx, db, params.id)
  return ok({ id: params.id }, { message: "Product deleted" })
})
