import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { deleteRole, updateRole } from "@/server/modules/org/service"
import { roleSchema } from "@/lib/validation/org"

export const PATCH = tenantRoute({ perm: "org.roles" }, async ({ req, ctx, db, params }) => {
  await updateRole(ctx, db, params.id, await parseBody(req, roleSchema))
  return ok({ id: params.id }, { message: "Role updated" })
})

export const DELETE = tenantRoute({ perm: "org.roles" }, async ({ ctx, db, params }) => {
  await deleteRole(ctx, db, params.id)
  return ok({ id: params.id }, { message: "Role deleted" })
})
