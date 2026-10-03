import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { loginUser } from "@/server/modules/auth/service"
import { loginSchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000)
  const { email, password } = await parseBody(req, loginSchema)
  await loginUser(email, password)
  return ok({ redirect: "/app" })
})
