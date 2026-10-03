import "server-only"
import type { TenantContext } from "@/server/auth/context"
import { AppError, forbidden, notFound } from "@/server/errors"
import { exportAccess, reportAccess, runReport, type SearchParams } from "./framework"
import { describeFilters, getReport, resolveFilters } from "./registry"

/** Resolve, access-check and run a report (shared by the viewer, JSON API, Excel export and print page). */
export async function loadReport(ctx: TenantContext, slug: string, sp: SearchParams, opts: { forExport?: boolean } = {}) {
  const def = getReport(slug)
  if (!def) throw notFound("Report not found")
  const access = reportAccess(ctx, def)
  if (!access.allowed) throw forbidden()
  if (access.locked)
    throw new AppError("FEATURE_LOCKED", `${def.title} is not included in the ${ctx.plan.name} plan. Upgrade to unlock it.`, { feature: access.missing[0] })
  if (opts.forExport) {
    const ex = exportAccess(ctx)
    if (!ex.allowed) throw forbidden("You do not have permission to export reports")
    if (ex.locked) throw new AppError("FEATURE_LOCKED", `Export is not included in the ${ctx.plan.name} plan. Upgrade to unlock it.`, { feature: "export" })
  }
  const { r, result } = await runReport(ctx, def, sp)
  const filters = await resolveFilters(ctx, def, r)
  return { def, r, result, filters, description: describeFilters(def, r, filters) }
}

export type LoadedReport = Awaited<ReturnType<typeof loadReport>>

/** Query string of the applied URL filters (to carry into export / print links). */
export function filterQuery(sp: SearchParams) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v
    if (val && k !== "page" && k !== "format") q.set(k, val)
  }
  return q.toString()
}
