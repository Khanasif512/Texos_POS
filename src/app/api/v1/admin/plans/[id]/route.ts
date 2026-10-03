import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { savePlan } from "@/server/modules/platform/service"
import { planSchema } from "@/lib/validation/billing"

/** TEN-03: limits and feature flags take effect for every tenant on this plan on their next request. */
export const PATCH = adminRoute(async ({ req, admin, params }) => {
  const r = await savePlan(admin, params.id, await parseBody(req, planSchema))
  return ok(r, { message: r.tenants ? `Plan saved — applies to ${r.tenants} tenant${r.tenants > 1 ? "s" : ""} now` : "Plan saved" })
})
