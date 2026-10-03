import { z } from "zod"
import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { changePlan, extendTrial, impersonate, setCompanyStatus } from "@/server/modules/platform/service"

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("extend_trial"), days: z.coerce.number().int().min(1).max(365) }),
  z.object({ action: z.literal("change_plan"), planId: z.string(), activate: z.boolean().default(false), cycle: z.enum(["monthly", "yearly"]).default("monthly") }),
  z.object({ action: z.literal("impersonate") }),
])

export const POST = adminRoute(async ({ req, admin, params }) => {
  const body = await parseBody(req, actionSchema)
  switch (body.action) {
    case "suspend":
      await setCompanyStatus(admin, params.id, "suspended")
      return ok({}, { message: "Company suspended" })
    case "reactivate":
      await setCompanyStatus(admin, params.id, "active")
      return ok({}, { message: "Company reactivated" })
    case "extend_trial":
      await extendTrial(admin, params.id, body.days)
      return ok({}, { message: `Trial extended by ${body.days} days` })
    case "change_plan":
      await changePlan(admin, params.id, body.planId, body.activate, body.cycle)
      return ok({}, { message: "Plan updated" })
    case "impersonate":
      await impersonate(admin, params.id)
      return ok({ redirect: "/app" }, { message: "Support session started" })
  }
})
