import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { lowStock } from "@/server/modules/inventory-ops/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"

/** GET /api/v1/inventory/low-stock?q&branchId&page&limit — branch balance ≤ reorder level (INV-03). */
export const GET = tenantRoute({ perm: "inventory.view" }, async ({ req, ctx }) => {
  const p = listArgsFromRequest(req, { sortable: [], defaultSort: "createdAt:desc" })
  const res = await lowStock(ctx, p)
  return ok(res.rows, { meta: listMeta(p, res.total) })
})
