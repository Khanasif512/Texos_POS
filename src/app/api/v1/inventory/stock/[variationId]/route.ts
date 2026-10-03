import { ok } from "@/server/api"
import { notFound } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { stockCard } from "@/server/modules/inventory-ops/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"

/** GET /api/v1/inventory/stock/:variationId?branchId&type&from&to&batches=all&page&limit — variation stock card. */
export const GET = tenantRoute({ perm: "inventory.view" }, async ({ req, ctx, params }) => {
  const p = listArgsFromRequest(req, { sortable: [], defaultSort: "createdAt:desc" })
  const card = await stockCard(ctx, params.variationId, { ...p, type: p.get("type"), allBatches: p.get("batches") === "all" })
  if (!card) throw notFound("Product")
  return ok(card, { meta: listMeta(p, card.ledgerTotal) })
})
