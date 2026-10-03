import { ok, parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { requirePermission } from "@/server/auth/context"
import { tenantRoute } from "@/server/route"
import { createOrder } from "@/server/modules/sales-after/orders"
import { listArgsFromRequest, listOrders } from "@/server/modules/sales-after/queries"
import { salesOrderSchema } from "@/lib/validation/sales-after"

/** GET /api/v1/sales-orders?q&type=quotation|order&status=open|converted|cancelled&branchId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: ["sales.view", "sales.create"] }, async ({ req, ctx, db }) => {
  const { page, limit, args } = listArgsFromRequest(req, ["date", "number", "total", "createdAt"], "date:desc")
  const r = await listOrders(ctx, db, args)
  return ok(r.rows, { meta: { page, limit, total: r.total } })
})

/** POST /api/v1/sales-orders — quotation (QT) or sales order (SO), optional advance on orders. */
export const POST = tenantRoute({ perm: "sales.create" }, async ({ req, ctx }) => {
  const input = await parseBody(req, salesOrderSchema)
  if (input.advance) requirePermission(ctx, "sales.receipt")
  return idempotent(req, ctx.companyId, "sales_orders.create", async () => {
    const data = await createOrder(ctx, input)
    return { data, status: 201, message: `${input.type === "quotation" ? "Quotation" : "Order"} ${data.number} saved` }
  })
})
