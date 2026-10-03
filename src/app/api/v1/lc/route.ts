import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createLc, listLcs } from "@/server/modules/lc/service"
import { lcSchema } from "@/lib/validation/lc"

/** GET /api/v1/lc?q&status&supplierId&branchId&page&limit&sort */
export const GET = tenantRoute({ perm: "lc.view", feature: "lc" }, async ({ req, ctx, db }) => {
  const p = listParams(req, ["createdAt", "lcNumber", "expectedArrivalDate", "openedDate", "status"])
  const { rows, total } = await listLcs(ctx, db, {
    q: p.q,
    status: p.sp.get("status") ?? undefined,
    supplierId: p.sp.get("supplierId") ?? undefined,
    branchId: p.branchId,
    skip: p.skip,
    take: p.limit,
    orderBy: p.orderBy,
  })
  return ok(rows, { meta: { page: p.page, limit: p.limit, total } })
})

export const POST = tenantRoute({ perm: "lc.create", feature: "lc" }, async ({ req, ctx, db }) => {
  const lc = await createLc(ctx, db, await parseBody(req, lcSchema))
  return ok({ id: lc.id, lcNumber: lc.lcNumber }, { status: 201, message: "LC created" })
})
