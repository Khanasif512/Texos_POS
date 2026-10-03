import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { changeStatus } from "@/server/modules/lc/service"
import { LC_STATUS_LABEL, lcStatusSchema } from "@/lib/validation/lc"

/** POST /api/v1/lc/:id/status {status, date?} — LC-10 workflow step. */
export const POST = tenantRoute({ perm: "lc.update", feature: "lc" }, async ({ req, ctx, db, params }) => {
  const input = await parseBody(req, lcStatusSchema)
  const lc = await changeStatus(ctx, db, params.id, input)
  return ok({ id: lc.id, status: lc.status }, { message: `LC marked ${LC_STATUS_LABEL[input.status].toLowerCase()}` })
})
