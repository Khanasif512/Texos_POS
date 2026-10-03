import { ok } from "@/server/api"
import { notFound } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { getGoodsReceipt } from "@/server/modules/purchasing/service"

/** GET /api/v1/goods-receipts/:id (costs only with inventory.view_cost) */
export const GET = tenantRoute({ perm: "purchase.view", feature: "purchase" }, async ({ ctx, params }) => {
  const r = await getGoodsReceipt(ctx, params.id)
  if (!r) throw notFound("Goods receipt")
  return ok(r)
})
