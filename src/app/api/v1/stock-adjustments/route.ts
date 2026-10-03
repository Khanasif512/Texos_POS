import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { createAdjustment } from "@/server/modules/inventory-ops/service"
import { ADJ_SORTABLE, listAdjustments } from "@/server/modules/inventory-ops/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"
import { adjustmentSchema } from "@/lib/validation/inventory"

/** GET /api/v1/stock-adjustments?q&reason&branchId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: "inventory.adjust" }, async ({ req, ctx }) => {
  const p = listArgsFromRequest(req, { sortable: ADJ_SORTABLE, defaultSort: "date:desc" })
  const res = await listAdjustments(ctx, { ...p, reason: p.get("reason") })
  return ok(res.rows, { meta: listMeta(p, res.total) })
})

/** POST /api/v1/stock-adjustments — INV-05 (reason code required). Send an Idempotency-Key header. */
export const POST = tenantRoute({ perm: "inventory.adjust" }, async ({ req, ctx }) => {
  const input = await parseBody(req, adjustmentSchema)
  return idempotent(req, ctx.companyId, "stock-adjustments.create", async () => ({
    data: await createAdjustment(ctx, input),
    message: "Stock adjusted",
    status: 201,
  }))
})
