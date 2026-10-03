import { z } from "zod"
import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { verifySignup } from "@/server/modules/auth/service"
import { verifySchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`verify:${clientIp(req)}`, 20, 15 * 60 * 1000)
  const body = await parseBody(req, verifySchema.extend({ plan: z.string().max(40).optional() }))
  const data = await verifySignup(body.verificationId, body.otp, body.plan)
  return ok(data, { message: "Workspace created" })
})
