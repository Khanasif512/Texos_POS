import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { loadReport } from "@/server/modules/reports/service"

/** GET /api/v1/reports/:slug?from&to&branchId&… — report data as JSON (same filters as the viewer). */
export const GET = tenantRoute({}, async ({ req, ctx, params }) => {
  const sp = Object.fromEntries(new URL(req.url).searchParams)
  const rep = await loadReport(ctx, params.slug, sp)
  return ok(rep.result, {
    meta: { report: rep.def.slug, title: rep.def.title, from: rep.r.from, to: rep.r.to, branchId: rep.r.branchId, filters: rep.description },
  })
})
