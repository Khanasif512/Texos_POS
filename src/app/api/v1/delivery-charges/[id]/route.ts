import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { notFound } from "@/server/errors"
import type { TenantDb } from "@/server/db"
import { deleteExpense, deliveryChargeWhere, updateDeliveryCharge } from "@/server/modules/finance/expenses"
import { deliveryChargeSchema } from "@/lib/validation/finance"

const PERM = ["delivery.manage", "lc.update"]

/** These routes only touch delivery-charge expenses; other expenses need the expenses.* permissions. */
async function assertDeliveryCharge(db: TenantDb, companyId: string, id: string) {
  const n = await db.expense.count({ where: { AND: [{ id }, await deliveryChargeWhere(companyId)] } })
  if (!n) throw notFound("Delivery charge")
}

export const PATCH = tenantRoute({ perm: PERM, feature: "lc" }, async ({ req, ctx, db, params }) => {
  await assertDeliveryCharge(db, ctx.companyId, params.id)
  const res = await updateDeliveryCharge(ctx, params.id, await parseBody(req, deliveryChargeSchema))
  return ok(res, { message: "Delivery charge updated" })
})

export const DELETE = tenantRoute({ perm: PERM, feature: "lc" }, async ({ ctx, db, params }) => {
  await assertDeliveryCharge(db, ctx.companyId, params.id)
  await deleteExpense(ctx, params.id)
  return ok(null, { message: "Delivery charge deleted" })
})
