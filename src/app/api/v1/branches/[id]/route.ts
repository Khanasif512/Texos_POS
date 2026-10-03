import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { updateBranch } from "@/server/modules/org/service"
import { branchSchema } from "@/lib/validation/org"

export const PATCH = tenantRoute({ perm: "org.branches" }, async ({ req, ctx, db, params }) => {
  const branch = await updateBranch(ctx, db, params.id, await parseBody(req, branchSchema))
  return ok(branch, { message: "Branch updated" })
})
