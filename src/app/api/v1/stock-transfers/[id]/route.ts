import { ok } from "@/server/api"
import { notFound } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { getTransfer } from "@/server/modules/inventory-ops/service"

/** GET /api/v1/stock-transfers/:id */
export const GET = tenantRoute({ perm: "inventory.transfer", feature: "multiBranchTransfer" }, async ({ ctx, params }) => {
  const t = await getTransfer(ctx, params.id)
  if (!t) throw notFound("Transfer")
  return ok(t)
})
