import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"
import { savePlan } from "@/server/modules/platform/service"
import { planSchema } from "@/lib/validation/billing"

export const GET = adminRoute(async () => {
  const plans = await prisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }] })
  return ok(plans.map((p) => ({ ...p, priceMonthly: num(p.priceMonthly), priceYearly: num(p.priceYearly) })))
})

export const POST = adminRoute(async ({ req, admin }) => {
  const r = await savePlan(admin, null, await parseBody(req, planSchema))
  return ok(r, { status: 201, message: "Plan created" })
})
