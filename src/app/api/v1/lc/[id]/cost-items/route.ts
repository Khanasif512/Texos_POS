import { ok, parseBody } from "@/server/api"
import { forbidden } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { addCostItem, getLcDetail } from "@/server/modules/lc/service"
import { newCostItemSchema } from "@/lib/validation/lc"

export const GET = tenantRoute({ perm: "lc.view", feature: "lc" }, async ({ ctx, db, params }) => {
  const lc = await getLcDetail(ctx, db, params.id)
  if (!lc.showCost) throw forbidden("You do not have permission to see LC costs")
  return ok(lc.costItems)
})

/** POST {costType, amount, description?, entryDate} — manual LC cost item (LC-02). */
export const POST = tenantRoute({ perm: "lc.update", feature: "lc" }, async ({ req, ctx, db, params }) => {
  const item = await addCostItem(ctx, db, params.id, await parseBody(req, newCostItemSchema))
  return ok({ id: item.id }, { status: 201, message: "Cost item added" })
})
