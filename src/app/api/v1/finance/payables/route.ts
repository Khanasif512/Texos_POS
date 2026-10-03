import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { num, sum } from "@/server/decimal"
import { payablesOverview } from "@/server/modules/finance/payments"

/** GET /api/v1/finance/payables — FIN-03 supplier payables overview. */
export const GET = tenantRoute({ perm: "finance.view" }, async ({ db }) => {
  const rows = await payablesOverview(db)
  const outstanding = num(sum(rows.filter((r) => r.outstanding > 0).map((r) => String(r.outstanding))))
  return ok(rows, { meta: { outstanding, suppliers: rows.length } })
})
