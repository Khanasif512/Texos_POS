import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { cancelTransfer } from "@/server/modules/inventory-ops/service"
import { cancelPurchaseOrderSchema as reasonSchema } from "@/lib/validation/purchasing"

/** POST /api/v1/stock-transfers/:id/cancel — pending only; stock returns to the source branch. */
export const POST = tenantRoute({ perm: "inventory.transfer", feature: "multiBranchTransfer" }, async ({ req, ctx, params }) => {
  const { reason } = await parseBody(req, reasonSchema)
  return ok(await cancelTransfer(ctx, params.id, reason), { message: "Transfer cancelled — stock returned to the source branch" })
})
