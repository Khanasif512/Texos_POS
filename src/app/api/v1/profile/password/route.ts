import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { changePassword } from "@/server/modules/org/service"
import { changePasswordSchema } from "@/lib/validation/org"

export const POST = tenantRoute({ allowReadOnly: true }, async ({ req, ctx }) => {
  const body = await parseBody(req, changePasswordSchema)
  await changePassword(ctx, body.current, body.password)
  return ok({ changed: true }, { message: "Password changed. Other devices were signed out." })
})
