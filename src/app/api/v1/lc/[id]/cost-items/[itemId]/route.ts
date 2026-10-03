import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { deleteCostItem, updateCostItem } from "@/server/modules/lc/service"
import { costItemSchema } from "@/lib/validation/lc"

/** Manual items only — items created from expenses / delivery charges are read-only here. */
export const PATCH = tenantRoute({ perm: "lc.update", feature: "lc" }, async ({ req, ctx, db, params }) => {
  const item = await updateCostItem(ctx, db, params.id, params.itemId, await parseBody(req, costItemSchema))
  return ok({ id: item.id }, { message: "Cost item updated" })
})

export const DELETE = tenantRoute({ perm: "lc.update", feature: "lc" }, async ({ ctx, db, params }) => {
  await deleteCostItem(ctx, db, params.id, params.itemId)
  return ok({ id: params.itemId }, { message: "Cost item removed" })
})
