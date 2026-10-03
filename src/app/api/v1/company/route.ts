import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { updateCompany } from "@/server/modules/org/service"
import { companySchema } from "@/lib/validation/org"

export const PATCH = tenantRoute({ perm: "settings.company" }, async ({ req, ctx }) => {
  const company = await updateCompany(ctx, await parseBody(req, companySchema))
  return ok({ id: company.id }, { message: "Company profile saved" })
})
