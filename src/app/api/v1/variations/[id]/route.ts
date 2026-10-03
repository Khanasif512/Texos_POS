import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { deleteVariation, patchVariation } from "@/server/modules/products/service"
import { variationPatchSchema } from "@/lib/validation/products"

/** Quick edit of one variation: {status?, salePrice?, wholesalePrice?, reorderLevel?} */
export const PATCH = tenantRoute({ perm: "inventory.update" }, async ({ req, ctx, db, params }) => {
  const res = await patchVariation(ctx, db, params.id, await parseBody(req, variationPatchSchema))
  return ok(res, { message: "Variation updated" })
})

/** Only variations without stock or history can be deleted; others must be deactivated. */
export const DELETE = tenantRoute({ perm: "inventory.delete" }, async ({ ctx, db, params }) => {
  await deleteVariation(ctx, db, params.id)
  return ok({ id: params.id }, { message: "Variation deleted" })
})
