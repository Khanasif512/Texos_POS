import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { createGoodsReceipt } from "@/server/modules/purchasing/service"
import { GRN_SORTABLE, listGoodsReceipts } from "@/server/modules/purchasing/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"
import { goodsReceiptSchema } from "@/lib/validation/purchasing"

/** GET /api/v1/goods-receipts?q&source=po|lc&branchId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: "purchase.view", feature: "purchase" }, async ({ req, ctx }) => {
  const p = listArgsFromRequest(req, { sortable: GRN_SORTABLE, defaultSort: "date:desc" })
  const res = await listGoodsReceipts(ctx, { ...p, source: p.get("source") })
  return ok(res.rows, { meta: listMeta(p, res.total) })
})

/** POST /api/v1/goods-receipts — PO-02 / LC-10. Send an Idempotency-Key header. */
export const POST = tenantRoute({ perm: "purchase.receive", feature: "purchase" }, async ({ req, ctx }) => {
  const input = await parseBody(req, goodsReceiptSchema)
  return idempotent(req, ctx.companyId, "goods-receipts.create", async () => ({
    data: await createGoodsReceipt(ctx, input),
    message: "Goods received into stock",
    status: 201,
  }))
})
