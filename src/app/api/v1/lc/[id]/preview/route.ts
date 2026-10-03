import { ok } from "@/server/api"
import { forbidden } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { getLcDetail } from "@/server/modules/lc/service"

/** GET /api/v1/lc/:id/preview — live engine result for both bases (nothing is saved). */
export const GET = tenantRoute({ perm: "lc.view", feature: "lc" }, async ({ ctx, db, params }) => {
  const lc = await getLcDetail(ctx, db, params.id)
  if (!lc.preview) throw forbidden("You do not have permission to see LC costs")
  return ok({ selectedBasis: lc.distributionBasis, costsChanged: lc.costsChanged, ...lc.preview })
})
