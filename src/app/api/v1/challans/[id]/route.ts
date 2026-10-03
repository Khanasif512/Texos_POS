import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { updateChallan } from "@/server/modules/sales/service"
import { challanUpdateSchema } from "@/lib/validation/sales"

/** PATCH /api/v1/challans/[id] — delivery details and delivered/undelivered (DLV-02). */
export const PATCH = tenantRoute({ perm: "delivery.manage" }, async ({ req, ctx, params }) => {
  const res = await updateChallan(ctx, params.id, await parseBody(req, challanUpdateSchema))
  return ok(res, { message: `Challan ${res.number} updated` })
})
