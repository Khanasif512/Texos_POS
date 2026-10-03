import { parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { saveCalculation } from "@/server/modules/lc/service"
import { calculationSchema } from "@/lib/validation/lc"

/**
 * POST {basis, reason?} — LC-04/05 finalization: saves the snapshot, sets status Cost finalized,
 * posts the supplier payable and revalues remaining stock, all in one transaction.
 */
export const POST = tenantRoute({ perm: "lc.finalize", feature: "lc" }, async ({ req, ctx, params }) => {
  const input = await parseBody(req, calculationSchema)
  return idempotent(req, ctx.companyId, "lc.finalize", async () => {
    const data = await saveCalculation(ctx, params.id, input, { finalize: true })
    return { data, status: 201, message: `Landed cost finalized (v${data.version})` }
  })
})
