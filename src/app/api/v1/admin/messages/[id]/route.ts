import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { setMessageHandled } from "@/server/modules/platform/service"
import { messageActionSchema } from "@/lib/validation/billing"

export const POST = adminRoute(async ({ req, admin, params }) => {
  const { handled } = await parseBody(req, messageActionSchema)
  await setMessageHandled(admin, params.id, handled)
  return ok({}, { message: handled ? "Marked handled" : "Reopened" })
})
