import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { branchFilter } from "@/server/auth/context"
import { dayKey, monthKeysOfYear, resolvePeriod } from "@/server/modules/finance/calc"
import { pnlByBranch, pnlPeriods, pnlStatement } from "@/server/modules/finance/pnl"

/**
 * GET /api/v1/finance/profit-loss?period=day|month|range&date=&month=&from=&to=&branchId=&year=
 * FIN-02 statement for the period, per-branch lines and the month-by-month table for `year`.
 */
export const GET = tenantRoute({ perm: "finance.view", feature: "advancedReports" }, async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams
  const period = resolvePeriod((k) => sp.get(k) ?? undefined, dayKey(new Date()))
  const f = branchFilter(ctx, sp.get("branchId"))
  const branchIds = typeof f.branchId === "string" ? [f.branchId] : f.branchId.in
  const scope = { companyId: ctx.companyId, branchIds }
  const [statement, byBranch, monthly] = await Promise.all([
    pnlStatement({ ...scope, from: period.from, to: period.to }),
    pnlByBranch({ ...scope, from: period.from, to: period.to }, ctx.branches),
    pnlPeriods({ ...scope, from: `${period.year}-01-01`, to: `${period.year}-12-31` }, "month", monthKeysOfYear(period.year)),
  ])
  return ok({ period, statement, byBranch, monthly })
})
