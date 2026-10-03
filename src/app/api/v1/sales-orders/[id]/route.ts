import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { getOrder, updateOrder } from "@/server/modules/sales-after/orders"
import { salesOrderSchema } from "@/lib/validation/sales-after"

/** GET /api/v1/sales-orders/:id — order with lines (variation details + branch stock), used by POS ?fromOrder=. */
export const GET = tenantRoute({ perm: ["sales.view", "sales.create"] }, async ({ ctx, db, params }) => ok(await getOrder(ctx, db, params.id)))

/** PATCH /api/v1/sales-orders/:id — edit an open quotation/order (type and branch are fixed). */
export const PATCH = tenantRoute({ perm: "sales.create" }, async ({ req, ctx, params }) => {
  const input = await parseBody(req, salesOrderSchema)
  const data = await updateOrder(ctx, params.id, { ...input, advance: null })
  return ok(data, { message: `${data.number} updated` })
})
