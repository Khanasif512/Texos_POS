import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { updateEmployee } from "@/server/modules/org/service"
import { employeeSchema } from "@/lib/validation/org"

export const PATCH = tenantRoute({ perm: "org.employees" }, async ({ req, ctx, db, params }) => {
  await updateEmployee(ctx, db, params.id, await parseBody(req, employeeSchema))
  return ok({ id: params.id }, { message: "Employee updated" })
})
