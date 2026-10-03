import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { AppError } from "@/server/errors"
import { cashDayReport } from "@/server/modules/finance/cash-closing"
import { dayKey, isDayKey } from "@/server/modules/finance/calc"

/** GET /api/v1/cash-closings/preview?branchId=&date=yyyy-mm-dd — live closing math, breakdown and expense summary (FIN-01, EXP-03). */
export const GET = tenantRoute({ perm: ["finance.cash_closing", "finance.view"] }, async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams
  const branchId = sp.get("branchId") || ctx.activeBranchId
  const date = sp.get("date") || dayKey(new Date())
  if (!isDayKey(date)) throw new AppError("VALIDATION_ERROR", "Invalid date")
  return ok(await cashDayReport(ctx, branchId, date))
})
