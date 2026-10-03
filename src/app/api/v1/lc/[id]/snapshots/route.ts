import { ok, parseBody } from "@/server/api"
import { forbidden } from "@/server/errors"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { getLcDetail, saveCalculation } from "@/server/modules/lc/service"
import { calculationSchema } from "@/lib/validation/lc"

/** GET — calculation history (LC-06). */
export const GET = tenantRoute({ perm: "lc.view", feature: "lc" }, async ({ ctx, db, params }) => {
  const lc = await getLcDetail(ctx, db, params.id)
  if (!lc.showCost) throw forbidden("You do not have permission to see LC costs")
  return ok(lc.snapshots)
})

/** POST {basis, reason?} — save a new landed-cost snapshot (calculation / correction, LC-07). */
export const POST = tenantRoute({ perm: "lc.finalize", feature: "lc" }, async ({ req, ctx, params }) => {
  const input = await parseBody(req, calculationSchema)
  return idempotent(req, ctx.companyId, "lc.snapshot", async () => {
    const data = await saveCalculation(ctx, params.id, input, { finalize: false })
    return { data, status: 201, message: `Landed cost v${data.version} saved` }
  })
})
