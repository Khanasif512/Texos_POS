import { ok, parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { createReceipt } from "@/server/modules/sales-after/receipts"
import { listArgsFromRequest, listReceipts } from "@/server/modules/sales-after/queries"
import { receiptSchema } from "@/lib/validation/sales-after"

/** GET /api/v1/receipts?q&branchId&method&status=active|cancelled&kind=advance|payment&customerId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: ["sales.view", "sales.receipt"] }, async ({ req, ctx, db }) => {
  const { page, limit, args } = listArgsFromRequest(req, ["date", "number", "amount", "createdAt"], "date:desc")
  const r = await listReceipts(ctx, db, args)
  return ok(r.rows, { meta: { page, limit, total: r.total, sumAmount: r.sumAmount } })
})

/** POST /api/v1/receipts — SLS-04 money receipt (Idempotency-Key header). */
export const POST = tenantRoute({ perm: "sales.receipt" }, async ({ req, ctx }) => {
  const input = await parseBody(req, receiptSchema)
  return idempotent(req, ctx.companyId, "receipts.create", async () => {
    const data = await createReceipt(ctx, input)
    return {
      data,
      status: 201,
      message: data.advance > 0 ? `Receipt ${data.number} saved — ${data.advance.toFixed(2)} kept as advance` : `Receipt ${data.number} saved`,
    }
  })
})
