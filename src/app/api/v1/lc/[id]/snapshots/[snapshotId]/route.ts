import { ok } from "@/server/api"
import { forbidden } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { canSeeLcCost, getSnapshot } from "@/server/modules/lc/service"

/** GET — one calculation with its per-line results and the cost items it used. */
export const GET = tenantRoute({ perm: "lc.view", feature: "lc" }, async ({ ctx, db, params }) => {
  if (!canSeeLcCost(ctx)) throw forbidden("You do not have permission to see LC costs")
  return ok(await getSnapshot(ctx, db, params.id, params.snapshotId))
})
