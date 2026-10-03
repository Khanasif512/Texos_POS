import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { STOCK_SORTABLE, stockOverview, stockSummary } from "@/server/modules/inventory-ops/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"

/**
 * GET /api/v1/inventory/stock?q&branchId&stock=in_stock|out_of_stock&page&limit&sort=product|sku|reorderLevel:asc
 * INV-03: per-branch balances, company total, value at cost (inventory.view_cost only).
 */
export const GET = tenantRoute({ perm: "inventory.view" }, async ({ req, ctx }) => {
  const p = listArgsFromRequest(req, { sortable: STOCK_SORTABLE, defaultSort: "product:asc" })
  const [res, summary] = await Promise.all([
    stockOverview(ctx, { ...p, stock: p.get("stock") }),
    stockSummary(ctx, p.branchId),
  ])
  return ok(res.rows, { meta: { ...listMeta(p, res.total), branches: res.branches, summary } })
})
