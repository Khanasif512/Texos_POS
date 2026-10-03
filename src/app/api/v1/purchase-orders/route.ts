import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { createPurchaseOrder } from "@/server/modules/purchasing/service"
import { listPurchaseOrders, PO_SORTABLE } from "@/server/modules/purchasing/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"
import { purchaseOrderSchema } from "@/lib/validation/purchasing"

/** GET /api/v1/purchase-orders?q&status&branchId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: "purchase.view", feature: "purchase" }, async ({ req, ctx }) => {
  const p = listArgsFromRequest(req, { sortable: PO_SORTABLE, defaultSort: "orderDate:desc" })
  const res = await listPurchaseOrders(ctx, { ...p, status: p.status })
  return ok(res.rows, { meta: listMeta(p, res.total) })
})

/** POST /api/v1/purchase-orders — PO-01 (local purchase, optional LC reference). */
export const POST = tenantRoute({ perm: "purchase.create", feature: "purchase" }, async ({ req, ctx }) => {
  const input = await parseBody(req, purchaseOrderSchema)
  return idempotent(req, ctx.companyId, "purchase-orders.create", async () => ({
    data: await createPurchaseOrder(ctx, input),
    message: "Purchase order created",
    status: 201,
  }))
})
