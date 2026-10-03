import { cookies } from "next/headers"
import { z } from "zod"
import { ok, parseBody } from "@/server/api"
import { assertBranch } from "@/server/auth/context"
import { COOKIES } from "@/server/auth/cookies"
import { tenantRoute } from "@/server/route"

/** Switch the active branch (UI default for new documents). Scope is still checked per request. */
export const POST = tenantRoute({ allowReadOnly: true }, async ({ req, ctx }) => {
  const { branchId } = await parseBody(req, z.object({ branchId: z.string() }))
  assertBranch(ctx, branchId)
  const jar = await cookies()
  jar.set(COOKIES.branch, branchId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 })
  return ok({ branchId })
})
