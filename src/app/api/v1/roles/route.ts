import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createRole } from "@/server/modules/org/service"
import { roleSchema } from "@/lib/validation/org"

export const POST = tenantRoute({ perm: "org.roles" }, async ({ req, ctx, db }) => {
  const role = await createRole(ctx, db, await parseBody(req, roleSchema))
  return ok({ id: role.id }, { status: 201, message: "Role created" })
})
