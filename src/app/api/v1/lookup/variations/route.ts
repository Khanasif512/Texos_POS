import { ok } from "@/server/api"
import { assertBranch } from "@/server/auth/context"
import { tenantRoute } from "@/server/route"
import { searchVariations } from "@/server/modules/lookup/service"

/** GET /api/v1/lookup/variations?q=&branchId= */
export const GET = tenantRoute({}, async ({ req, ctx, db }) => {
  const sp = new URL(req.url).searchParams
  const branchId = sp.get("branchId") || undefined
  if (branchId) assertBranch(ctx, branchId)
  return ok(await searchVariations(ctx, db, sp.get("q") ?? "", branchId, Math.min(50, Number(sp.get("limit")) || 20)))
})
