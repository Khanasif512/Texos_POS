import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { requestPasswordReset } from "@/server/modules/auth/service"
import { forgotSchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000)
  const { email } = await parseBody(req, forgotSchema)
  await requestPasswordReset(email)
  return ok({ sent: true }, { message: "If that email is registered, a reset link is on its way." })
})
