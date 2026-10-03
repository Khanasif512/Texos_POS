import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { reportCatalogue } from "@/server/modules/reports/registry"

/** GET /api/v1/reports — reports the user may open, grouped; plan-locked ones flagged. */
export const GET = tenantRoute({ perm: ["reports.sales", "reports.stock", "reports.financial", "finance.cash_closing"] }, async ({ ctx }) => {
  return ok(
    reportCatalogue(ctx).map((g) => ({
      group: g.group,
      reports: g.reports.map(({ def, access }) => ({
        slug: def.slug,
        title: def.title,
        description: def.description,
        date: def.date,
        locked: access.locked,
        filters: (def.filters ?? []).map((f) => ({ key: f.key, label: f.label, kind: f.kind })),
      })),
    })),
  )
})
