import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { cancelOrder } from "@/server/modules/sales-after/orders"
import { cancelSchema } from "@/lib/validation/sales-after"

/** POST /api/v1/sales-orders/:id/cancel { reason } — SLS-07 order cancel (distinct from invoice cancel). */
export const POST = tenantRoute({ perm: "sales.cancel" }, async ({ req, ctx, params }) => {
  const data = await cancelOrder(ctx, params.id, await parseBody(req, cancelSchema))
  return ok(data, {
    message: data.advanceKept > 0 ? `${data.number} cancelled — advance ${data.advanceKept.toFixed(2)} kept as customer advance` : `${data.number} cancelled`,
  })
})
