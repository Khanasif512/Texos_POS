import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createDeliveryCharge, deliveryChargeWhere } from "@/server/modules/finance/expenses"
import { deliveryTotalsByLc, listExpenses } from "@/server/modules/finance/queries"
import { deliveryChargeSchema } from "@/lib/validation/finance"

const PERM = ["delivery.manage", "lc.update"]

/** GET /api/v1/delivery-charges?page&limit&q&from&to&branchId&lcId — list + totals by LC (DLV-03). */
export const GET = tenantRoute({ perm: [...PERM, "lc.view"], feature: "lc" }, async ({ req, ctx }) => {
  const p = listParams(req, ["date", "amount", "number"], "date:desc")
  const lcId = p.sp.get("lcId") ?? undefined
  const [list, byLc] = await Promise.all([
    listExpenses(ctx, { q: p.q, branchId: p.branchId, from: p.from, to: p.to, lcId, skip: p.skip, take: p.limit, orderBy: p.orderBy }, await deliveryChargeWhere(ctx.companyId)),
    deliveryTotalsByLc(ctx, { branchId: p.branchId, from: p.from, to: p.to }),
  ])
  return ok(list.rows, { meta: { page: p.page, limit: p.limit, total: list.total, sum: list.totals.amount, byLc } })
})

/** DLV-01: delivery charge against an LC → Expense (Delivery Charge, allocated) + LcCostItem "delivery_charge". */
export const POST = tenantRoute({ perm: PERM, feature: "lc" }, async ({ req, ctx }) => {
  const res = await createDeliveryCharge(ctx, await parseBody(req, deliveryChargeSchema))
  return ok(res, { status: 201, message: `Delivery charge ${res.number} added to the LC` })
})
