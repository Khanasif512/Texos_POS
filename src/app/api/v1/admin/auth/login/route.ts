import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { loginAdmin } from "@/server/modules/auth/service"
import { loginSchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`admin-login:${clientIp(req)}`, 10, 15 * 60 * 1000)
  const { email, password } = await parseBody(req, loginSchema)
  await loginAdmin(email, password)
  return ok({ redirect: "/admin" })
})
