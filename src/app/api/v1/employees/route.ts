import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createEmployee } from "@/server/modules/org/service"
import { employeeSchema } from "@/lib/validation/org"

export const POST = tenantRoute({ perm: "org.employees" }, async ({ req, ctx, db }) => {
  const res = await createEmployee(ctx, db, await parseBody(req, employeeSchema))
  return ok(res, { status: 201, message: "Employee added" })
})
