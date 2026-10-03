import { parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { addOrderAdvance } from "@/server/modules/sales-after/orders"
import { advanceSchema } from "@/lib/validation/sales-after"

/** POST /api/v1/sales-orders/:id/advance { amount, method, reference? } — advance money receipt on an open order. */
export const POST = tenantRoute({ perm: "sales.receipt" }, async ({ req, ctx, params }) => {
  const input = await parseBody(req, advanceSchema)
  return idempotent(req, ctx.companyId, "sales_orders.advance", async () => {
    const data = await addOrderAdvance(ctx, params.id, input)
    return { data, status: 201, message: `Advance receipt ${data.receipt.number} saved` }
  })
})
