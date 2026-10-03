import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { resetPassword } from "@/server/modules/auth/service"
import { resetSchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000)
  const { token, password } = await parseBody(req, resetSchema)
  await resetPassword(token, password)
  return ok({ redirect: "/login" }, { message: "Password updated. Please sign in." })
})
