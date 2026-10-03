import { ok } from "@/server/api"
import { assertBranch } from "@/server/auth/context"
import { tenantRoute } from "@/server/route"
import { listSalesmen } from "@/server/modules/sales/service"

/** GET /api/v1/pos/salesmen?branchId= — active employees who can be credited with a sale (SLS-09). */
export const GET = tenantRoute({ perm: ["sales.create", "sales.view"] }, async ({ req, ctx }) => {
  const branchId = new URL(req.url).searchParams.get("branchId")
  if (branchId) assertBranch(ctx, branchId)
  return ok(await listSalesmen(ctx, branchId))
})
