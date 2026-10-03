import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createBranch } from "@/server/modules/org/service"
import { branchSchema } from "@/lib/validation/org"

export const GET = tenantRoute({}, async ({ db, ctx }) => {
  const branches = await db.branch.findMany({
    where: ctx.allBranches ? {} : { id: { in: ctx.branchIds } },
    orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
  })
  return ok(branches)
})

export const POST = tenantRoute({ perm: "org.branches" }, async ({ req, ctx, db }) => {
  const branch = await createBranch(ctx, db, await parseBody(req, branchSchema))
  return ok(branch, { status: 201, message: "Branch created" })
})
