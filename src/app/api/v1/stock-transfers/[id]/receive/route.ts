import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { receiveTransfer } from "@/server/modules/inventory-ops/service"

/** POST /api/v1/stock-transfers/:id/receive — destination branch staff confirm arrival (transfer_in). */
export const POST = tenantRoute({ perm: "inventory.transfer", feature: "multiBranchTransfer" }, async ({ req, ctx, params }) =>
  idempotent(req, ctx.companyId, "stock-transfers.receive", async () => ({
    data: await receiveTransfer(ctx, params.id),
    message: "Transfer received into stock",
  })),
)
