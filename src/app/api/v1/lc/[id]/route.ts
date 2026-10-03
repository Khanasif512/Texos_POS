import { ok } from "@/server/api"
import { AppError } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { deleteLc, getLcDetail, updateLc } from "@/server/modules/lc/service"

export const GET = tenantRoute({ perm: "lc.view", feature: "lc" }, async ({ ctx, db, params }) => {
  return ok(await getLcDetail(ctx, db, params.id))
})

/** Full edit before receipt; afterwards only rate / basis / notes / arrival date (validated in the service). */
export const PATCH = tenantRoute({ perm: "lc.update", feature: "lc" }, async ({ req, ctx, db, params }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body")
  }
  const lc = await updateLc(ctx, db, params.id, body)
  return ok({ id: lc.id }, { message: "LC updated" })
})

export const DELETE = tenantRoute({ perm: "lc.delete", feature: "lc" }, async ({ ctx, db, params }) => {
  await deleteLc(ctx, db, params.id)
  return ok({ id: params.id }, { message: "LC deleted" })
})
