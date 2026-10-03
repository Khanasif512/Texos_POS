import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { createSupplierPayment } from "@/server/modules/finance/payments"
import { listSupplierPayments } from "@/server/modules/finance/queries"
import { supplierPaymentSchema } from "@/lib/validation/finance"

/** GET /api/v1/supplier-payments?page&limit&sort&q&from&to&branchId&supplierId&method */
export const GET = tenantRoute({ perm: ["finance.view", "finance.supplier_payment"] }, async ({ req, ctx }) => {
  const p = listParams(req, ["date", "amount", "number"], "date:desc")
  const data = await listSupplierPayments(ctx, {
    q: p.q,
    branchId: p.branchId,
    supplierId: p.sp.get("supplierId") ?? undefined,
    method: p.sp.get("method") ?? undefined,
    from: p.from,
    to: p.to,
    skip: p.skip,
    take: p.limit,
    orderBy: p.orderBy,
  })
  return ok(data.rows, { meta: { page: p.page, limit: p.limit, total: data.total, sum: data.sum } })
})

/** FIN-03: record a supplier payment (idempotent — send an Idempotency-Key header). */
export const POST = tenantRoute({ perm: "finance.supplier_payment" }, async ({ req, ctx }) => {
  const input = await parseBody(req, supplierPaymentSchema)
  return idempotent(req, ctx.companyId, "supplier-payments", async () => {
    const data = await createSupplierPayment(ctx, input)
    return { data, status: 201, message: `Payment ${data.number} recorded` }
  })
})
