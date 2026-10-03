import { ok } from "@/server/api"
import { notFound } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { getAdjustment } from "@/server/modules/inventory-ops/service"

/** GET /api/v1/stock-adjustments/:id */
export const GET = tenantRoute({ perm: ["inventory.adjust", "inventory.view"] }, async ({ ctx, params }) => {
  const a = await getAdjustment(ctx, params.id)
  if (!a) throw notFound("Adjustment")
  return ok(a)
})
