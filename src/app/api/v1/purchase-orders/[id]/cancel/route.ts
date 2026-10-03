import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { cancelPurchaseOrder } from "@/server/modules/purchasing/service"
import { cancelPurchaseOrderSchema } from "@/lib/validation/purchasing"

/** POST /api/v1/purchase-orders/:id/cancel — PO-03 (whole order, or the unreceived remainder). */
export const POST = tenantRoute({ perm: "purchase.update", feature: "purchase" }, async ({ req, ctx, params }) => {
  const { reason } = await parseBody(req, cancelPurchaseOrderSchema)
  const res = await cancelPurchaseOrder(ctx, params.id, reason)
  return ok(res, { message: res.status === "cancelled" ? "Purchase order cancelled" : "Remaining quantity cancelled" })
})
