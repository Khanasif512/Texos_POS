import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { closeCashDay, closingHistory } from "@/server/modules/finance/cash-closing"
import { cashClosingSchema } from "@/lib/validation/finance"

/** GET /api/v1/cash-closings?branchId=&limit= — history of closings, newest first. */
export const GET = tenantRoute({ perm: ["finance.cash_closing", "finance.view"] }, async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams
  const branchId = sp.get("branchId")
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30))
  return ok(await closingHistory(ctx, branchId && branchId !== "all" ? branchId : null, limit))
})

/** FIN-01: close the day for a branch (re-closing is owner-only and audited). */
export const POST = tenantRoute({ perm: "finance.cash_closing" }, async ({ req, ctx }) => {
  const input = await parseBody(req, cashClosingSchema)
  return idempotent(req, ctx.companyId, "cash-closings", async () => {
    const data = await closeCashDay(ctx, input)
    return { data, status: data.reclosed ? 200 : 201, message: data.reclosed ? "Day re-closed" : "Day closed" }
  })
})
