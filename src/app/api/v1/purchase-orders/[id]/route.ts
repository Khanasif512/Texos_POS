import { ok, parseBody } from "@/server/api"
import { notFound } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { getPurchaseOrder, updatePurchaseOrder } from "@/server/modules/purchasing/service"
import { purchaseOrderSchema } from "@/lib/validation/purchasing"

/** GET /api/v1/purchase-orders/:id */
export const GET = tenantRoute({ perm: "purchase.view", feature: "purchase" }, async ({ ctx, params }) => {
  const po = await getPurchaseOrder(ctx, params.id)
  if (!po) throw notFound("Purchase order")
  return ok(po)
})

/** PATCH /api/v1/purchase-orders/:id — only while pending with nothing received. */
export const PATCH = tenantRoute({ perm: "purchase.update", feature: "purchase" }, async ({ req, ctx, params }) => {
  const res = await updatePurchaseOrder(ctx, params.id, await parseBody(req, purchaseOrderSchema))
  return ok(res, { message: "Purchase order updated" })
})
