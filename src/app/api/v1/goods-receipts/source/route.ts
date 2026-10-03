import { ok } from "@/server/api"
import { assertFeature } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { lcReceivable, poReceivable } from "@/server/modules/purchasing/service"
import { openReceiptSources } from "@/server/modules/purchasing/queries"

/**
 * GET /api/v1/goods-receipts/source?poId= | ?lcId= — what can still be received (remaining qty, unit cost).
 * Without a parameter: open POs and LCs ready to receive.
 */
export const GET = tenantRoute({ perm: "purchase.receive", feature: "purchase" }, async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams
  const poId = sp.get("poId")
  const lcId = sp.get("lcId")
  if (poId && lcId) throw new AppError("VALIDATION_ERROR", "Pass either poId or lcId")
  if (poId) return ok({ kind: "po", po: await poReceivable(ctx, poId) })
  if (lcId) {
    assertFeature(ctx, "lc")
    return ok({ kind: "lc", lc: await lcReceivable(ctx, lcId) })
  }
  return ok({ kind: "open", ...(await openReceiptSources(ctx)) })
})
