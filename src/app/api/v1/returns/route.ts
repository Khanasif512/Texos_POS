import { ok, parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { createReturn } from "@/server/modules/sales-after/returns"
import { listArgsFromRequest, listReturns } from "@/server/modules/sales-after/queries"
import { returnSchema } from "@/lib/validation/sales-after"

/** GET /api/v1/returns?q&status=pending|approved|rejected&mode&branchId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: ["sales.view", "sales.return", "sales.return_approve"] }, async ({ req, ctx, db }) => {
  const { page, limit, args } = listArgsFromRequest(req, ["date", "number", "totalAmount", "createdAt"], "date:desc")
  const r = await listReturns(ctx, db, args)
  return ok(r.rows, { meta: { page, limit, total: r.total, pending: r.pending } })
})

/** POST /api/v1/returns — request a return (status pending until approved). */
export const POST = tenantRoute({ perm: "sales.return" }, async ({ req, ctx }) => {
  const input = await parseBody(req, returnSchema)
  return idempotent(req, ctx.companyId, "returns.create", async () => {
    const data = await createReturn(ctx, input)
    return { data, status: 201, message: `Return ${data.number} sent for approval` }
  })
})
