import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { cancelReceipt } from "@/server/modules/sales-after/receipts"
import { cancelSchema } from "@/lib/validation/sales-after"

/** POST /api/v1/receipts/:id/cancel { reason } — reverses allocations and the ledger credit (audited). */
export const POST = tenantRoute({ perm: "sales.cancel" }, async ({ req, ctx, params }) => {
  const data = await cancelReceipt(ctx, params.id, await parseBody(req, cancelSchema))
  return ok(data, { message: `Receipt ${data.number} cancelled` })
})
