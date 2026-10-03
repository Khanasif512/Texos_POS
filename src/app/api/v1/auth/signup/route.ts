import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { startSignup } from "@/server/modules/auth/service"
import { signupSchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000)
  const body = await parseBody(req, signupSchema)
  const data = await startSignup(body)
  return ok(data, { message: "Verification code sent", status: 201 })
})
